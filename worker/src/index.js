const DEFAULTS = Object.freeze({
  serviceName: "ramaverse-api",
  displayName: "RamaVerse API",
  environment: "production",
  version: "1.0.0",
  allowedOrigins: ["https://ramaverse.omsaravanabhava.org", "https://ssakthivel02.github.io"],
});

function getConfig(env) {
  const configuredOrigins = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return {
    serviceName: env.SERVICE_NAME || DEFAULTS.serviceName,
    displayName: env.SERVICE_DISPLAY_NAME || DEFAULTS.displayName,
    environment: env.ENVIRONMENT || DEFAULTS.environment,
    version: env.SERVICE_VERSION || DEFAULTS.version,
    allowedOrigins: new Set(configuredOrigins.length ? configuredOrigins : DEFAULTS.allowedOrigins),
  };
}

function getRequestId(request) {
  const supplied = request.headers.get("X-Request-ID") || "";
  return /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function buildHeaders(origin, requestId, allowedOrigins) {
  const result = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Request-ID": requestId,
  });
  if (origin && allowedOrigins.has(origin)) {
    result.set("Access-Control-Allow-Origin", origin);
    result.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    result.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-Client-ID");
    result.set("Access-Control-Expose-Headers", "X-Request-ID");
    result.set("Access-Control-Max-Age", "86400");
    result.set("Vary", "Origin");
  }
  return result;
}

function json(data, status, headers, method = "GET") {
  return new Response(method === "HEAD" ? null : JSON.stringify(data), { status, headers });
}

async function rateLimitKey(request, serviceName, pathname) {
  const clientId = request.headers.get("X-Client-ID") || "";
  if (/^[A-Za-z0-9._-]{8,128}$/.test(clientId)) return `${serviceName}:client:${clientId}:${pathname}`;

  const authorization = request.headers.get("Authorization") || "";
  if (authorization) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(authorization));
    const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${serviceName}:auth:${hash}:${pathname}`;
  }

  return `${serviceName}:anonymous:${request.headers.get("CF-Connecting-IP") || "unknown"}:${pathname}`;
}

async function enforceRateLimit(request, env, cfg, url, responseHeaders) {
  if (!env.RATE_LIMITER || url.pathname !== "/api/v1/ping") return null;
  const key = await rateLimitKey(request, cfg.serviceName, url.pathname);
  const result = await env.RATE_LIMITER.limit({ key });
  if (result.success) return null;
  responseHeaders.set("Retry-After", "60");
  return json({ error: "rate_limit_exceeded", message: "Too many requests. Try again later." }, 429, responseHeaders, request.method);
}

async function handle(request, env) {
  const cfg = getConfig(env);
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const requestId = getRequestId(request);
  const responseHeaders = buildHeaders(origin, requestId, cfg.allowedOrigins);

  if (request.method === "OPTIONS") {
    if (!origin || !cfg.allowedOrigins.has(origin)) {
      return json({ error: "cors_origin_not_allowed", message: "The requesting origin is not permitted.", requestId }, 403, responseHeaders);
    }
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    responseHeaders.set("Allow", "GET, HEAD, OPTIONS");
    return json({ error: "method_not_allowed", message: `Method ${request.method} is not supported.`, requestId }, 405, responseHeaders, request.method);
  }

  const limited = await enforceRateLimit(request, env, cfg, url, responseHeaders);
  if (limited) return limited;

  const common = { service: cfg.serviceName, name: cfg.displayName, environment: cfg.environment, version: cfg.version, requestId };

  if (url.pathname === "/") return json({ ...common, message: `${cfg.displayName} is online`, health: "/health", api: "/api/v1" }, 200, responseHeaders, request.method);
  if (url.pathname === "/health" || url.pathname === "/api/v1/health") return json({ status: "ok", ...common, timestamp: new Date().toISOString() }, 200, responseHeaders, request.method);
  if (url.pathname === "/version") return json(common, 200, responseHeaders, request.method);
  if (url.pathname === "/api/v1") return json({ ...common, apiVersion: "v1", endpoints: { status: "/api/v1/status", health: "/api/v1/health", ping: "/api/v1/ping" } }, 200, responseHeaders, request.method);
  if (url.pathname === "/api/v1/status") return json({ status: "ok", ...common, apiVersion: "v1", timestamp: new Date().toISOString() }, 200, responseHeaders, request.method);
  if (url.pathname === "/api/v1/ping") return json({ status: "ok", ...common, apiVersion: "v1", message: "pong", timestamp: new Date().toISOString() }, 200, responseHeaders, request.method);

  return json({ error: "not_found", message: "The requested API route was not found.", path: url.pathname, requestId }, 404, responseHeaders, request.method);
}

export default {
  async fetch(request, env) {
    const started = Date.now();
    let response;
    try {
      response = await handle(request, env);
      return response;
    } catch (error) {
      const requestId = getRequestId(request);
      console.error({ level: "error", event: "worker_exception", service: getConfig(env).serviceName, requestId, message: error instanceof Error ? error.message : "Unknown Worker exception" });
      response = json({ error: "internal_server_error", message: "An unexpected error occurred.", requestId }, 500, new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId }));
      return response;
    } finally {
      const url = new URL(request.url);
      console.log({ level: "info", event: "request_completed", service: getConfig(env).serviceName, method: request.method, path: url.pathname, status: response?.status || 500, durationMs: Date.now() - started, requestId: response?.headers.get("X-Request-ID") || null, cfRay: request.headers.get("CF-Ray") || null, colo: request.cf?.colo || null, country: request.cf?.country || null });
    }
  },
};
