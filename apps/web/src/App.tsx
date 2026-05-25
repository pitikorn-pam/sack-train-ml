const pipelineStages = [
  'Dataset validation',
  'YOLO train (.pt)',
  'FP32 evaluation',
  'ONNX export',
  'Hailo compile (.hef)',
  'INT8 evaluation',
  'HEF meta generation',
  'Release bundle / downloads',
  'Future registry',
]

const plannedPages = [
  'Run list',
  'Run details',
  'Pipeline timeline',
  'Artifact downloads (.pt / .hef)',
  'Release bundle inspector',
  'Registry-ready release catalog',
]

export default function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">BSCP / Training Pipeline Scaffold</p>
          <h1>sack-train-ml</h1>
          <p className="subtext">
            Scaffold-only dashboard shell for a Seed-style training pipeline that ends in
            downloadable <code>.pt</code> and <code>.hef</code> artifacts.
          </p>
        </div>
        <div className="status-card">
          <div className="status-pill">Scaffold only</div>
          <ul>
            <li>No training backend yet</li>
            <li>No Hailo compile integration yet</li>
            <li>No registry yet</li>
          </ul>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Pipeline stages</h2>
          <div className="stage-list">
            {pipelineStages.map((stage, index) => (
              <div key={stage} className="stage-card">
                <span className="stage-index">{index + 1}</span>
                <div>
                  <h3>{stage}</h3>
                  <p>Reserved structure only. Implementation comes later.</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Planned pages</h2>
          <ul className="planned-pages">
            {plannedPages.map((page) => (
              <li key={page}>{page}</li>
            ))}
          </ul>
        </section>

        <section className="panel full-width">
          <h2>Short-term artifact contract</h2>
          <div className="artifact-grid">
            <div className="artifact-card">
              <h3>best.pt</h3>
              <p>Training output for inspection, rollback, and HEF compilation input.</p>
            </div>
            <div className="artifact-card">
              <h3>model.hef</h3>
              <p>Hailo-target runtime artifact for edge deployment workflows.</p>
            </div>
            <div className="artifact-card">
              <h3>model.hef.meta.yaml</h3>
              <p>Generated provenance, accuracy, and gate metadata.</p>
            </div>
            <div className="artifact-card">
              <h3>release-manifest.json</h3>
              <p>Download bundle index and registry-ready summary record.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
