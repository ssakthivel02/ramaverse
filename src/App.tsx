import { useEffect, useMemo, useState } from "react";
import routes from "./data/routes.json";
import { readCanonicalStatus, type CanonicalStatus } from "./lib/canonical";

type Route = (typeof routes)[number];

const kandaNames = [
  "Bala Kanda",
  "Ayodhya Kanda",
  "Aranya Kanda",
  "Kishkindha Kanda",
  "Sundara Kanda",
  "Yuddha Kanda",
  "Uttara Kanda",
];

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

  const current = routes.find((route) => route.path === path) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return routes.slice(0, 8);
    return routes.filter((route) =>
      `${route.label} ${route.group} ${route.description}`.toLowerCase().includes(needle),
    );
  }, [query]);

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
          <div className={`trust-pill ${canonical.state}`} role="status">
            <span className="dot" />
            <div>
              <strong>{canonical.state === "ready" ? "Canonical gate ready" : "Canonical isolation active"}</strong>
              <small>{canonical.message}</small>
            </div>
          </div>
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
            placeholder="Search characters, Kandas, places, wisdom, journeys…"
          />
        </label>
        <div className="route-grid">
          {filtered.map((route) => (
            <button className="route-card" key={route.path} onClick={() => navigate(route.path)}>
              <small>{route.group}</small>
              <strong>{route.label}</strong>
              <span>{route.description}</span>
              <b aria-hidden="true">↗</b>
            </button>
          ))}
        </div>
      </section>

      <section className="shell principles">
        <article>
          <span>01</span><h3>Source before synthesis</h3>
          <p>Reading and intelligence surfaces are designed to keep source, editorial context and generated reflection visibly separate.</p>
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

function RoutePage({ route, canonical }: { route: Route; canonical: CanonicalStatus }) {
  const siblings = routes.filter((item) => item.group === route.group && item.path !== route.path).slice(0, 4);
  return (
    <section className="shell route-page">
      <button className="back" onClick={() => navigate("/")}>← RamaVerse</button>
      <p className="eyebrow">{route.group.toUpperCase()}</p>
      <h1>{route.label}</h1>
      <p className="route-intro">{route.description}</p>

      <div className="route-stage">
        <div className="stage-mark" aria-hidden="true">{route.label.slice(0, 1)}</div>
        <div>
          <small>Clean-room website foundation</small>
          <h2>Interface ready. Canonical content remains gated.</h2>
          <p>{canonical.message}</p>
        </div>
      </div>

      <div className="related">
        <h2>Continue exploring</h2>
        <div className="route-grid">
          {siblings.map((item) => (
            <button className="route-card" key={item.path} onClick={() => navigate(item.path)}>
              <small>{item.group}</small><strong>{item.label}</strong><span>{item.description}</span><b>↗</b>
            </button>
          ))}
        </div>
      </div>
    </section>
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
