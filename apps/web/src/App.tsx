import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { SignIn, SignOutButton, useSession } from "./components/Auth";
import { ToastProvider } from "./components/Toast";
import { NotificationCenter } from "./components/NotificationCenter";
import { Logo } from "./components/Logo";
import { Overview } from "./sections/Overview";
import { Train } from "./sections/Train";
import { Models } from "./sections/Models";
import { Storage } from "./sections/Storage";
import { Lab } from "./sections/Lab";

type Section = "overview" | "train" | "models" | "storage" | "lab";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "train", label: "Train" },
  { key: "models", label: "Models" },
  { key: "storage", label: "Storage" },
  { key: "lab", label: "Lab" },
];

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const session = useSession();
  const [section, setSection] = useState<Section>("overview");

  const isAdmin = useMemo(() => {
    if (session === "loading" || session === null) return false;
    const meta = (session.user.app_metadata ?? {}) as Record<string, unknown>;
    return meta.role === "admin";
  }, [session]);

  // Dev-only UI preview: `?preview=1` renders the app shell without a session so a
  // form can be looked at (or screenshotted) without a magic-link round trip.
  // import.meta.env.DEV is false in a production build, so this cannot ship.
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).has("preview");

  if (!preview && session === "loading") return <div className="app-shell"><p>Loading…</p></div>;

  if (!preview && session === null) {
    return (
      <div className="app-shell">
        <header className="hero">
          <h1>BSCP sack-train-ml</h1>
          <p className="subtext">Training pipeline dashboard.</p>
        </header>
        <main><SignIn /></main>
      </div>
    );
  }

  const email = session !== "loading" && session !== null ? (session.user.email ?? "(unknown)") : "preview@local";

  return (
    <div className="app-shell">
      <header className="app-topbar" aria-label="Model registry navigation">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <Logo size={28} />
            <div className="topbar-brand-text">
              <p className="eyebrow">BSCP</p>
              <h1>sack-train-ml</h1>
            </div>
          </div>
          <nav className="topbar-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className={section === s.key ? "active" : ""}
                onClick={() => setSection(s.key)}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="topbar-account">
            <NotificationCenter
              email={email}
              onJump={(target) => {
                if (target === "overview" || target === "train" || target === "models" || target === "storage") {
                  setSection(target);
                }
              }}
            />
            <div className="topbar-account-card">
              <code className="topbar-user">{email}</code>
              <span className={`role-badge ${isAdmin ? "admin" : "read"}`}>
                {isAdmin && <Star size={10} fill="currentColor" strokeWidth={0} />}
                {isAdmin ? "admin" : "authenticated"}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="section-main">
        {section === "overview" && <Overview onJump={setSection} />}
        {section === "train" && <Train />}
        {section === "models" && <Models isAdmin={isAdmin} />}
        {section === "storage" && <Storage isAdmin={isAdmin} />}
        {section === "lab" && <Lab />}
      </main>
    </div>
  );
}
