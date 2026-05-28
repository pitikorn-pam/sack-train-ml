import { useState } from "react";
import { NewRun } from "../components/NewRun";
import { RunsList } from "../components/RunsList";
import { RunDetail } from "../components/RunDetail";

type Tab = "form" | "live" | "recent";

export function Train() {
  const [tab, setTab] = useState<Tab>("recent");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [prefillConfig, setPrefillConfig] = useState<Record<string, unknown> | null>(null);

  return (
    <div>
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

      <div className="train-layout">
        <div>
          {tab === "form" && (
            <NewRun
              initialConfig={prefillConfig}
              onCreated={(id) => {
                setSelectedRun(id);
                setPrefillConfig(null);
                setTab("live");
              }}
            />
          )}
          {tab === "live" && <RunsList filter="running" onSelect={setSelectedRun} />}
          {tab === "recent" && <RunsList onSelect={setSelectedRun} />}
        </div>

        <div>
          {selectedRun ? (
            <RunDetail
              runId={selectedRun}
              onBack={() => setSelectedRun(null)}
              onRecreate={(cfg) => {
                setPrefillConfig(cfg);
                setSelectedRun(null);
                setTab("form");
              }}
            />
          ) : (
            <div className="panel empty-state">
              <p>Select a run</p>
              <p className="muted">Click a row on the left to see live metrics + logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
