import { useState } from "react";
import { NewRunV3 } from "../components/NewRunV3";
import { RunsList } from "../components/RunsList";
import { RunDetail } from "../components/RunDetail";

type Tab = "form" | "live" | "recent";

export function Train() {
  const [tab, setTab] = useState<Tab>("recent");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  // "Re-create with same config" used to hand the config to a callback that ignored
  // it and opened a blank form. The config now reaches the form.
  const [prefill, setPrefill] = useState<{ runId: string; config: Record<string, unknown> } | null>(null);

  return (
    <div>
      <div className="sub-tabs">
        <button
          className={tab === "form" ? "active" : ""}
          onClick={() => {
            setPrefill(null);
            setTab("form");
          }}
        >
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
          // Remount when the source run changes, so the form re-seeds from it.
          key={prefill?.runId ?? "blank"}
          prefill={prefill}
          onCreated={(id) => {
            setSelectedRun(id);
            setPrefill(null);
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
                onRecreate={(config) => {
                  setPrefill({ runId: selectedRun, config });
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
      )}
    </div>
  );
}
