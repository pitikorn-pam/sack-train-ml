/**
 * Minimal YOLO dataset YAML parser.
 *
 * Extracts class names and (optionally) train/val/test references.
 * Not a general YAML parser — only handles the subset YOLO datasets use.
 */

export interface ParsedYoloYaml {
  path?: string;
  train?: string;
  val?: string;
  test?: string;
  names: string[];
}

export function parseYoloYaml(text: string): ParsedYoloYaml {
  const out: ParsedYoloYaml = { names: [] };
  const lines = text.split(/\r?\n/);
  let mode: "scalar" | "names-map" | "names-list" = "scalar";
  const indexed: Record<number, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    if (mode !== "scalar") {
      if (/^\s/.test(line) === false) {
        mode = "scalar";
      } else if (mode === "names-list") {
        const m = line.match(/^\s*-\s*(.+)$/);
        if (m) {
          out.names.push(stripQuotes(m[1]));
          continue;
        }
        mode = "scalar";
      } else if (mode === "names-map") {
        const m = line.match(/^\s*(\d+)\s*:\s*(.+)$/);
        if (m) {
          indexed[Number(m[1])] = stripQuotes(m[2]);
          continue;
        }
        mode = "scalar";
      }
    }

    const kv = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();

    if (key === "names") {
      if (!val || val === "{}") {
        // assume sub-block follows (map or list)
        const peek = (lines[i + 1] || "").trim();
        mode = peek.startsWith("-") ? "names-list" : "names-map";
      } else if (val.startsWith("[")) {
        out.names = val
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean);
      } else if (val.startsWith("{")) {
        out.names = val
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((p) => stripQuotes(p.split(":").slice(1).join(":").trim()))
          .filter(Boolean);
      }
    } else if (key === "path" || key === "train" || key === "val" || key === "test") {
      out[key as "path" | "train" | "val" | "test"] = stripQuotes(val);
    }
  }

  if (out.names.length === 0 && Object.keys(indexed).length > 0) {
    const max = Math.max(...Object.keys(indexed).map(Number));
    out.names = Array.from({ length: max + 1 }, (_, k) => indexed[k] ?? `class_${k}`);
  }

  return out;
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^['"]/, "").replace(/['"]$/, "");
}
