import { useMemo, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
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

/**
 * The section a URL names. Kept as a type so a typo in a path is a compile error rather
 * than a blank screen.
 *
 * These were component state until 2026-09-07 — `useState<Section>("overview")` — which
 * meant no tab could be bookmarked or shared, every link opened on Overview, the browser
 * back button left the app instead of returning to the previous tab, and a refresh
 * discarded whatever was being configured. See docs/web-review.md finding 2.
 */
export type Section = "overview" | "train" | "models" | "storage" | "lab";

export const SECTIONS: { key: Section; label: string; path: string }[] = [
  { key: "overview", label: "Overview", path: "/overview" },
  { key: "train", label: "Train", path: "/train" },
  { key: "models", label: "Models", path: "/models" },
  { key: "storage", label: "Storage", path: "/storage" },
  { key: "lab", label: "Lab", path: "/lab" },
];

export const pathForSection = (s: Section) =>
  SECTIONS.find((entry) => entry.key === s)?.path ?? "/overview";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </BrowserRouter>
  );
}

function AppInner() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = useMemo(() => {
    if (session === "loading" || session === null) return false;
    const meta = (session.user.app_metadata ?? {}) as Record<string, unknown>;
    return meta.role === "admin";
  }, [session]);

  // Dev-only UI preview: `?preview=1` renders the app shell without a session so a form
  // can be looked at (or screenshotted) without signing in. import.meta.env.DEV is false
  // in a production build, so this cannot ship — tests/test_production_bundle.py checks
  // the emitted bundle rather than trusting this comment.
  //
  // Read ONCE, into state: with a router, navigating to another path replaces
  // location.search, so reading it per render would drop preview on the first click.
  const [preview] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview"),
  );

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

  const email =
    session !== "loading" && session !== null ? (session.user.email ?? "(unknown)") : "preview@local";

  // Keep ?preview=1 attached while navigating, or the first click signs you out of the
  // preview and lands on the sign-in screen.
  const to = (path: string) => (preview ? `${path}${location.search || "?preview=1"}` : path);
  const jump = (s: Section) => navigate(to(pathForSection(s)));

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
              <NavLink
                key={s.key}
                to={to(s.path)}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-account">
            <NotificationCenter email={email} onJump={jump} />
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
        <Routes>
          <Route path="/overview" element={<Overview onJump={jump} />} />
          <Route path="/train" element={<Train />} />
          <Route path="/models" element={<Models isAdmin={isAdmin} />} />
          <Route path="/storage" element={<Storage isAdmin={isAdmin} />} />
          <Route path="/lab" element={<Lab />} />
          {/* An unknown path lands on Overview rather than a blank screen, and `replace`
              keeps it out of history so Back does not bounce between the two. */}
          <Route path="*" element={<Navigate to={to("/overview")} replace />} />
        </Routes>
      </main>
    </div>
  );
}
