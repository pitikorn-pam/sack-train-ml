import { useState } from "react";
import { NewRun } from "../components/NewRun";
import { RunsList } from "../components/RunsList";
import { RunDetail } from "../components/RunDetail";

type Tab = "form" | "live" | "recent";

export function Train() {
  const [tab, setTab] = useState<Tab>("recent");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  if (selectedRun) {
    return <RunDetail runId={selectedRun} onBack={() => setSelectedRun(null)} />;
  }

  return (
    <div className="train">
      <div className="sub-tabs">
        <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>
          New run
        </button>
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>
          Live
        </button>
        <button className={tab === "recent" ? "active" : ""} onClick={() => setTab("recent")}>
          Recent
        </button>
      </div>

      {tab === "form" && (
        <NewRun
          onCreated={(id) => {
            setSelectedRun(id);
            setTab("live");
          }}
        />
      )}
      {tab === "live" && <RunsList filter="running" onSelect={setSelectedRun} />}
      {tab === "recent" && <RunsList onSelect={setSelectedRun} />}
    </div>
  );
}
