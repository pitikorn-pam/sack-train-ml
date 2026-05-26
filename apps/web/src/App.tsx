import { useState } from "react";
import { SignIn, SignOutButton, useSession } from "./components/Auth";
import { Overview } from "./sections/Overview";
import { Train } from "./sections/Train";
import { Models } from "./sections/Models";
import { Storage } from "./sections/Storage";

type Section = "overview" | "train" | "models" | "storage";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "train", label: "Train" },
  { key: "models", label: "Models" },
  { key: "storage", label: "Storage" },
];

export default function App() {
  const session = useSession();
  const [section, setSection] = useState<Section>("overview");

  if (session === "loading") return <div className="app-shell"><p>Loading…</p></div>;

  if (session === null) {
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

  return (
    <div className="app-shell">
      <header className="app-topbar" aria-label="Model registry navigation">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <p className="eyebrow">BSCP</p>
            <h1>sack-train-ml</h1>
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
            <span className="topbar-user">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="section-main">
        {section === "overview" && <Overview onJumpToTrain={() => setSection("train")} />}
        {section === "train" && <Train />}
        {section === "models" && <Models />}
        {section === "storage" && <Storage />}
      </main>
    </div>
  );
}
