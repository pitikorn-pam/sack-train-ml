import { useState } from "react";
import { SignIn, SignOutButton, useSession } from "./components/Auth";
import { RunsList } from "./components/RunsList";
import { RunDetail } from "./components/RunDetail";
import { NewRun } from "./components/NewRun";

export default function App() {
  const session = useSession();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [view, setView] = useState<"runs" | "new">("runs");

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
      <header className="hero">
        <div>
          <p className="eyebrow">BSCP / Training Pipeline</p>
          <h1>sack-train-ml</h1>
          <p className="subtext">Signed in as <code>{session.user.email}</code></p>
        </div>
        <div className="status-card">
          <SignOutButton />
        </div>
      </header>

      <nav className="nav-tabs">
        <button onClick={() => { setView("runs"); setSelectedRun(null); }} disabled={view === "runs" && !selectedRun}>Runs</button>
        <button onClick={() => { setView("new"); setSelectedRun(null); }} disabled={view === "new"}>New run</button>
      </nav>

      <main className="grid">
        {selectedRun ? (
          <RunDetail runId={selectedRun} onBack={() => setSelectedRun(null)} />
        ) : view === "new" ? (
          <NewRun onCreated={(id) => { setSelectedRun(id); setView("runs"); }} />
        ) : (
          <RunsList onSelect={setSelectedRun} />
        )}
      </main>
    </div>
  );
}
