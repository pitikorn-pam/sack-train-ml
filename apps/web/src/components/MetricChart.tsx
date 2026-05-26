/**
 * MetricChart — interactive SVG trend chart for run_metrics.
 *
 * Features:
 *   - One line per selected metric, color-coded
 *   - Hover to inspect exact (step, value, metric) at cursor
 *   - Zoom 1x / 2x / 4x + Reset (zoom focuses on most recent N% of steps)
 *   - Optional points (toggle)
 *   - Click metric pill to toggle inclusion
 */
import { useMemo, useState } from "react";
import type { RunMetric } from "../lib/supabase";

const COLORS: Record<string, string> = {
  map50: "#3b82f6",
  map50_95: "#8b5cf6",
  precision: "#10b981",
  recall: "#f59e0b",
  f1: "#ec4899",
  box_loss: "#ef4444",
  cls_loss: "#fb923c",
  dfl_loss: "#a78bfa",
  val_box_loss: "#dc2626",
  val_cls_loss: "#ea580c",
  val_dfl_loss: "#7c3aed",
  lr_pg0: "#64748b",
  lr_pg1: "#475569",
  lr_pg2: "#334155",
  progress: "#22d3ee",
};

const DEFAULT_VISIBLE = new Set(["map50", "map50_95", "precision", "recall", "progress"]);

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 8, right: 12, bottom: 24, left: 36 };

export function MetricChart({ metrics }: { metrics: RunMetric[] }) {
  const [visible, setVisible] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [showPoints, setShowPoints] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ step: number; x: number } | null>(null);

  // Group metrics by name and derive F1 from precision+recall if missing
  const grouped = useMemo(() => {
    const byName: Record<string, RunMetric[]> = {};
    for (const m of metrics) {
      (byName[m.name] ??= []).push(m);
    }
    for (const arr of Object.values(byName)) {
      arr.sort((a, b) => a.step - b.step);
    }
    // Derive f1 = 2*p*r/(p+r)
    if (!byName.f1 && byName.precision && byName.recall) {
      const recallByStep: Record<number, number> = {};
      for (const r of byName.recall) recallByStep[r.step] = r.value;
      byName.f1 = byName.precision
        .map((p) => {
          const r = recallByStep[p.step];
          if (r == null || p.value + r === 0) return null;
          return {
            run_id: p.run_id,
            step: p.step,
            epoch: p.epoch,
            name: "f1",
            value: (2 * p.value * r) / (p.value + r),
            ts: p.ts,
          } as RunMetric;
        })
        .filter((x): x is RunMetric => !!x);
    }
    return byName;
  }, [metrics]);

  const allNames = Object.keys(grouped).sort();

  const maxStep = useMemo(() => {
    let m = 0;
    for (const arr of Object.values(grouped)) {
      for (const r of arr) if (r.step > m) m = r.step;
    }
    return m;
  }, [grouped]);

  // Zoom: focus on most recent (1/zoom) of x-axis
  const xMin = Math.max(0, maxStep - maxStep / zoom);
  const xMax = Math.max(1, maxStep);

  // Compute y bounds from visible metrics within x range
  const yBounds = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const name of visible) {
      const arr = grouped[name];
      if (!arr) continue;
      for (const r of arr) {
        if (r.step < xMin || r.step > xMax) continue;
        if (r.value < lo) lo = r.value;
        if (r.value > hi) hi = r.value;
      }
    }
    if (lo === Infinity) return { lo: 0, hi: 1 };
    if (lo === hi) {
      const pad = Math.abs(lo) * 0.1 + 1e-6;
      return { lo: lo - pad, hi: hi + pad };
    }
    const pad = (hi - lo) * 0.05;
    return { lo: lo - pad, hi: hi + pad };
  }, [grouped, visible, xMin, xMax]);

  function xScale(step: number): number {
    const t = xMax === xMin ? 0.5 : (step - xMin) / (xMax - xMin);
    return PADDING.left + t * (WIDTH - PADDING.left - PADDING.right);
  }

  function yScale(value: number): number {
    const t = (value - yBounds.lo) / (yBounds.hi - yBounds.lo);
    return HEIGHT - PADDING.bottom - t * (HEIGHT - PADDING.top - PADDING.bottom);
  }

  function pathFor(arr: RunMetric[]): string {
    const pts = arr.filter((r) => r.step >= xMin && r.step <= xMax);
    if (pts.length === 0) return "";
    return pts
      .map((r, i) => `${i === 0 ? "M" : "L"}${xScale(r.step).toFixed(1)},${yScale(r.value).toFixed(1)}`)
      .join(" ");
  }

  function nearestStep(svgX: number): number {
    const t = (svgX - PADDING.left) / (WIDTH - PADDING.left - PADDING.right);
    return Math.round(xMin + t * (xMax - xMin));
  }

  function toggleMetric(name: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Hover readout
  const hoverValues = useMemo(() => {
    if (!hover) return null;
    const step = hover.step;
    const out: { name: string; value: number; color: string }[] = [];
    for (const name of visible) {
      const arr = grouped[name];
      if (!arr) continue;
      // find closest by step
      let best: RunMetric | null = null;
      let bestDist = Infinity;
      for (const r of arr) {
        const d = Math.abs(r.step - step);
        if (d < bestDist) {
          bestDist = d;
          best = r;
        }
      }
      if (best) out.push({ name, value: best.value, color: COLORS[name] ?? "#94a3b8" });
    }
    return out;
  }, [hover, grouped, visible]);

  return (
    <div className="metric-chart">
      <div className="metric-toolbar">
        <div className="metric-pills">
          {allNames.map((name) => (
            <button
              key={name}
              className={`metric-pill${visible.has(name) ? " active" : ""}`}
              onClick={() => toggleMetric(name)}
              style={visible.has(name) ? { borderColor: COLORS[name] ?? "#94a3b8" } : undefined}
            >
              <span className="metric-pill-dot" style={{ background: COLORS[name] ?? "#94a3b8" }} />
              {name}
              {grouped[name] && (
                <span className="muted">{grouped[name][grouped[name].length - 1].value.toFixed(3)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="metric-actions">
          <label className="metric-checkbox">
            <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
            Points
          </label>
          <button onClick={() => setZoom(Math.min(8, zoom * 2))}>+</button>
          <button onClick={() => setZoom(Math.max(1, zoom / 2))}>−</button>
          <button onClick={() => setZoom(1)} disabled={zoom === 1}>Reset</button>
        </div>
      </div>

      {allNames.length === 0 ? (
        <div className="muted metric-empty">No metrics yet — waiting for the run to start streaming.</div>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="metric-svg"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
            setHover({ step: nearestStep(svgX), x: svgX });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* axes */}
          <line x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="#334155" />
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom} stroke="#334155" />
          {/* y ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const v = yBounds.lo + t * (yBounds.hi - yBounds.lo);
            const y = yScale(v);
            return (
              <g key={t}>
                <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="#1f2937" />
                <text x={PADDING.left - 4} y={y + 3} fontSize="10" fill="#64748b" textAnchor="end">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}
          {/* x ticks */}
          {[0, 0.5, 1].map((t) => {
            const s = xMin + t * (xMax - xMin);
            const x = xScale(s);
            return (
              <text key={t} x={x} y={HEIGHT - PADDING.bottom + 14} fontSize="10" fill="#64748b" textAnchor="middle">
                {Math.round(s)}
              </text>
            );
          })}
          {/* lines */}
          {[...visible].map((name) => {
            const arr = grouped[name];
            if (!arr) return null;
            const color = COLORS[name] ?? "#94a3b8";
            return (
              <g key={name}>
                <path d={pathFor(arr)} stroke={color} strokeWidth="1.6" fill="none" />
                {showPoints &&
                  arr
                    .filter((r) => r.step >= xMin && r.step <= xMax)
                    .map((r) => (
                      <circle key={r.step} cx={xScale(r.step)} cy={yScale(r.value)} r="2" fill={color} />
                    ))}
              </g>
            );
          })}
          {/* hover */}
          {hover && (
            <line
              x1={xScale(hover.step)}
              x2={xScale(hover.step)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="#475569"
              strokeDasharray="3 3"
            />
          )}
        </svg>
      )}

      {hover && hoverValues && hoverValues.length > 0 && (
        <div className="metric-readout">
          <span className="muted">step {hover.step}:</span>
          {hoverValues.map((v) => (
            <span key={v.name} className="metric-readout-item">
              <span className="metric-pill-dot" style={{ background: v.color }} />
              {v.name} <strong>{v.value.toFixed(4)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
