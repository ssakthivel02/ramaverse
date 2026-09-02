import { FormEvent, useEffect, useMemo, useState } from "react";
import routes from "./data/routes.json";
import { experiences, kandaNames } from "./data/experience";
import { readCanonicalStatus, type CanonicalStatus } from "./lib/canonical";

type Route = (typeof routes)[number];

function normalizePath(pathname: string) {
  const clean = pathname.replace(/\/+$/, "");
  return clean || "/";
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [query, setQuery] = useState("");
  const [canonical, setCanonical] = useState<CanonicalStatus>({
    state: "pending",
    baseline: null,
    message: "Checking canonical import gate…",
  });

  useEffect(() => {
    const sync = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", sync);
    void readCanonicalStatus().then(setCanonical);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    const route = routes.find((item) => item.path === path);
    document.title = route
      ? `${route.label} — RamaVerse`
      : "RamaVerse — Ramayana Knowledge Universe";
  }, [path]);

  const current = routes.find((route) => route.path === path) ?? null;
  const filtered = useMemo(() => filterRoutes(query), [query]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header">
        <button className="brand" onClick={() => navigate("/")} aria-label="RamaVerse home">
          <span className="brand-mark" aria-hidden="true">ॐ</span>
          <span>
            <strong>RamaVerse</strong>
            <small>रामायण ज्ञान ब्रह्माण्ड</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
          {["/knowledge", "/kandas", "/characters", "/journey", "/ask", "/sources"].map((item) => {
            const route = routes.find((r) => r.path === item)!;
            return (
              <button key={item} className={path === item ? "active" : ""} onClick={() => navigate(item)}>
                {route.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main id="main">
        {path === "/" ? (
          <Home canonical={canonical} query={query} setQuery={setQuery} filtered={filtered} />
        ) : current ? (
          <RoutePage route={current} canonical={canonical} />
        ) : (
          <NotFound />
        )}
      </main>

      <footer>
        <div>
          <strong>RamaVerse</strong>
          <span>Source-aware • Accessible • Canonical-first</span>
        </div>
        <button onClick={() => navigate("/sources")}>Provenance & sources</button>
      </footer>
    </>
  );
}

function filterRoutes(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return routes.slice(0, 8);
  return routes.filter((route) =>
    `${route.label} ${route.group} ${route.description}`.toLowerCase().includes(needle),
  );
}

function Home({
  canonical,
  query,
  setQuery,
  filtered,
}: {
  canonical: CanonicalStatus;
  query: string;
  setQuery: (value: string) => void;
  filtered: Route[];
}) {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">THE RAMAYANA, REIMAGINED AS A KNOWLEDGE UNIVERSE</p>
          <h1>Walk the epic.<br /><span>Understand the source.</span></h1>
          <p className="hero-text">
            A clean-room, next-generation RamaVerse experience designed around the seven Kandas,
            character relationships, sacred geography, source-aware reading, learning and bounded intelligence.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate("/knowledge")}>Enter Knowledge</button>
            <button onClick={() => navigate("/journey")}>Begin the Journey</button>
          </div>
          <TrustPill canonical={canonical} />
        </div>
        <div className="cosmos" aria-label="Seven Kanda visual navigator">
          <div className="sun-core">
            <span>राम</span>
            <small>RAMA</small>
          </div>
          {kandaNames.map((name, index) => (
            <button
              key={name}
              className={`orbit-node orbit-${index + 1}`}
              onClick={() => navigate("/kandas")}
              aria-label={`Explore ${name}`}
            >
              <span>{index + 1}</span>
              <small>{name.replace(" Kanda", "")}</small>
            </button>
          ))}
          <div className="orbit-ring ring-one" aria-hidden="true" />
          <div className="orbit-ring ring-two" aria-hidden="true" />
          <div className="orbit-ring ring-three" aria-hidden="true" />
        </div>
      </section>

      <section className="shell search-panel" aria-labelledby="discover-title">
        <div>
          <p className="eyebrow">DISCOVER</p>
          <h2 id="discover-title">One universe. Many ways in.</h2>
        </div>
        <label>
          <span className="sr-only">Search RamaVerse experiences</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search experiences: characters, Kandas, places, wisdom, journeys…"
          />
        </label>
        <RouteGrid items={filtered} />
      </section>

      <section className="shell principles">
        <article>
          <span>01</span><h3>Source before synthesis</h3>
          <p>Reading and intelligence surfaces keep source, editorial context and generated reflection visibly separate.</p>
        </article>
        <article>
          <span>02</span><h3>Epic, not generic</h3>
          <p>The visual language is purpose-built for RamaVerse: celestial navigation, narrative journeys, sacred geography and restrained motion.</p>
        </article>
        <article>
          <span>03</span><h3>Canonical-first engineering</h3>
          <p>The application refuses to treat an unapproved corpus as canonical. The verified 550 pack must pass a controlled import gate.</p>
        </article>
      </section>
    </>
  );
}

function TrustPill({ canonical }: { canonical: CanonicalStatus }) {
  return (
    <div className={`trust-pill ${canonical.state}`} role="status">
      <span className="dot" />
      <div>
        <strong>{canonical.state === "ready" ? "Canonical gate ready" : "Canonical isolation active"}</strong>
        <small>{canonical.message}</small>
      </div>
    </div>
  );
}

function RoutePage({ route, canonical }: { route: Route; canonical: CanonicalStatus }) {
  const experience = experiences[route.path];
  const siblings = routes.filter((item) => item.group === route.group && item.path !== route.path).slice(0, 4);

  return (
    <section className="shell route-page">
      <button className="back" onClick={() => navigate("/")}>← RamaVerse</button>
      <div className="route-heading">
        <div>
          <p className="eyebrow">{route.group.toUpperCase()}</p>
          <h1>{route.label}</h1>
          <p className="route-intro">{experience?.headline ?? route.description}</p>
          {experience?.promise ? <p className="route-promise">{experience.promise}</p> : null}
        </div>
        <TrustPill canonical={canonical} />
      </div>

      <RouteWorkspace route={route} canonical={canonical} />

      <div className="related">
        <h2>Continue exploring</h2>
        <RouteGrid items={siblings.length ? siblings : routes.filter((item) => item.path !== route.path).slice(0, 4)} />
      </div>
    </section>
  );
}

function RouteWorkspace({ route, canonical }: { route: Route; canonical: CanonicalStatus }) {
  if (route.path === "/search") return <SearchWorkspace canonical={canonical} />;
  if (route.path === "/ask") return <AskWorkspace canonical={canonical} />;
  if (route.path === "/kandas") return <KandaWorkspace canonical={canonical} />;
  if (route.path === "/sources") return <SourcesWorkspace canonical={canonical} />;

  const experience = experiences[route.path];
  return (
    <>
      <div className="route-stage">
        <div className="stage-mark" aria-hidden="true">{route.label.slice(0, 1)}</div>
        <div>
          <small>RamaVerse clean-room experience</small>
          <h2>{canonical.state === "ready" ? "Interface ready for governed integration." : "Interface ready. Canonical content remains gated."}</h2>
          <p>{canonical.message}</p>
        </div>
      </div>
      {experience ? <ModuleGrid modules={experience.modules} /> : null}
    </>
  );
}

function ModuleGrid({ modules }: { modules: (typeof experiences)[string]["modules"] }) {
  return (
    <div className="module-grid" aria-label="Experience capability status">
      {modules.map((item) => (
        <article className="module-card" key={item.title}>
          <span className={`module-status ${item.status}`}>
            {item.status === "shell-ready" ? "Shell ready" : "Canonical required"}
          </span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

function KandaWorkspace({ canonical }: { canonical: CanonicalStatus }) {
  return (
    <div className="workspace-panel">
      <div className="workspace-head">
        <div>
          <small>SEVEN-KANDA NAVIGATOR</small>
          <h2>Structure first. Source text only after verification.</h2>
        </div>
        <span className={`gate-badge ${canonical.state}`}>{canonical.state}</span>
      </div>
      <div className="kanda-grid">
        {kandaNames.map((name, index) => (
          <article key={name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{name}</h3>
            <p>{canonical.state === "ready" ? "Canonical integration gate is available for this Kanda." : "Canonical Sarga/content records are intentionally not reconstructed in this branch."}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SearchWorkspace({ canonical }: { canonical: CanonicalStatus }) {
  const [value, setValue] = useState("");
  const items = useMemo(() => filterRoutes(value), [value]);

  return (
    <div className="workspace-panel">
      <div className="workspace-head">
        <div>
          <small>SAFE SEARCH MODE</small>
          <h2>Search RamaVerse experiences now.</h2>
          <p>Canonical record search remains unavailable until the verified 550 corpus is imported.</p>
        </div>
        <span className={`gate-badge ${canonical.state}`}>{canonical.state}</span>
      </div>
      <label className="workspace-search">
        <span className="sr-only">Search RamaVerse routes</span>
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Try: graph, audio, stories, sources…" autoFocus />
      </label>
      <RouteGrid items={items} />
    </div>
  );
}

function AskWorkspace({ canonical }: { canonical: CanonicalStatus }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) {
      setResult("Enter a question first.");
      return;
    }
    if (canonical.state !== "ready") {
      setResult("RamaVerse will not generate a canonical answer because the verified 550-record source pack is not active. Your question was not sent to an external model.");
      return;
    }
    setResult("The canonical manifest is ready, but the governed retrieval/answer engine is not wired in this foundation stage. No answer has been fabricated.");
  }

  return (
    <div className="workspace-panel ask-workspace">
      <div className="workspace-head">
        <div>
          <small>BOUNDED ANSWER MODE</small>
          <h2>Ask without sacrificing provenance.</h2>
          <p>This UI demonstrates the refusal boundary: missing source context produces no synthetic canonical answer.</p>
        </div>
        <span className={`gate-badge ${canonical.state}`}>{canonical.state}</span>
      </div>
      <form onSubmit={submit}>
        <label>
          <span>Your question</span>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about the Ramayana…" rows={5} />
        </label>
        <button className="primary" type="submit">Check source-backed availability</button>
      </form>
      {result ? <div className="answer-boundary" role="status"><strong>RamaVerse response boundary</strong><p>{result}</p></div> : null}
    </div>
  );
}

function SourcesWorkspace({ canonical }: { canonical: CanonicalStatus }) {
  const checks = [
    ["Expected canonical baseline", "550 records"],
    ["Silent regeneration", "Forbidden"],
    ["Cross-project source mixing", "Forbidden"],
    ["Mobile / VC14 mutation", "Outside this website branch"],
    ["Production cutover", "Explicit authorization required"],
  ];

  return (
    <div className="workspace-panel sources-workspace">
      <div className="workspace-head">
        <div>
          <small>TRUST & PROVENANCE</small>
          <h2>Canonical status is a product surface.</h2>
          <p>{canonical.message}</p>
        </div>
        <span className={`gate-badge ${canonical.state}`}>{canonical.state}</span>
      </div>
      <div className="trust-table" role="table" aria-label="RamaVerse integrity controls">
        {checks.map(([label, value]) => (
          <div role="row" key={label}>
            <span role="cell">{label}</span>
            <strong role="cell">{value}</strong>
          </div>
        ))}
      </div>
      <div className="source-callout">
        <strong>Current rule</strong>
        <p>The interface may advance independently, but canonical records stay closed until the authoritative package is available and reconciled record-by-record.</p>
      </div>
    </div>
  );
}

function RouteGrid({ items }: { items: Route[] }) {
  if (!items.length) return <p className="empty-state">No matching RamaVerse experience.</p>;
  return (
    <div className="route-grid">
      {items.map((route) => (
        <button className="route-card" key={route.path} onClick={() => navigate(route.path)}>
          <small>{route.group}</small>
          <strong>{route.label}</strong>
          <span>{route.description}</span>
          <b aria-hidden="true">↗</b>
        </button>
      ))}
    </div>
  );
}

function NotFound() {
  return (
    <section className="shell route-page">
      <p className="eyebrow">404</p>
      <h1>That path is outside the current RamaVerse map.</h1>
      <button className="primary" onClick={() => navigate("/")}>Return home</button>
    </section>
  );
}

export default App;
