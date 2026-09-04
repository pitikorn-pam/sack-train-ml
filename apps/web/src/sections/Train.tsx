import { useState } from "react";
import { NewRunV3 } from "../components/NewRunV3";
import { RunsList } from "../components/RunsList";
import { RunDetail } from "../components/RunDetail";

type Tab = "form" | "live" | "recent";

export function Train() {
  const [tab, setTab] = useState<Tab>("recent");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

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

      {/* The New-run form carries its own effective-config panel, so it takes the full
          width. The list tabs keep the two-column layout with run detail beside them. */}
      {tab === "form" ? (
        <NewRunV3
          onCreated={(id) => {
            setSelectedRun(id);
            setTab("live");
          }}
        />
      ) : (
        <div className="train-layout">
          <div>
            {tab === "live" && <RunsList filter="running" onSelect={setSelectedRun} />}
            {tab === "recent" && <RunsList onSelect={setSelectedRun} />}
          </div>

          <div>
            {selectedRun ? (
              <RunDetail
                runId={selectedRun}
                onBack={() => setSelectedRun(null)}
                onRecreate={() => setTab("form")}
              />
            ) : (
              <div className="panel empty-state">
                <p>Select a run</p>
                <p className="muted">Click a row on the left to see live metrics + logs.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
