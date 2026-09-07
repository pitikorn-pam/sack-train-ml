/**
 * Every section has a URL.
 *
 * They were component state until 2026-09-07, so no tab could be bookmarked or shared,
 * every link opened on Overview, the browser back button left the app, and a refresh
 * discarded whatever was being configured. See docs/web-review.md finding 2.
 *
 * This pins the part that is cheap to break: the section list and its paths, and the
 * mapping the notification centre and Overview's jump buttons both go through.
 */
import { describe, it, expect } from "vitest";
import { SECTIONS, pathForSection, type Section } from "./App";

describe("the section table", () => {
  it("covers every section the app renders", () => {
    const keys = SECTIONS.map((s) => s.key).sort();
    expect(keys).toEqual(["lab", "models", "overview", "storage", "train"]);
  });

  it("gives each one a distinct absolute path", () => {
    const paths = SECTIONS.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p.startsWith("/")).toBe(true);
  });

  it("gives each one a label a person can read", () => {
    for (const s of SECTIONS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.label).not.toBe(s.key); // a raw key in the nav is a missing label
    }
  });
});

describe("pathForSection", () => {
  it("round-trips every section", () => {
    for (const s of SECTIONS) expect(pathForSection(s.key)).toBe(s.path);
  });

  it("falls back to overview rather than to an empty string", () => {
    // The notification centre passes strings that came from stored activity ids, so an
    // old id naming a section that no longer exists must land somewhere real.
    expect(pathForSection("nonexistent" as Section)).toBe("/overview");
  });

  it("never returns a relative path, which would nest on repeat navigation", () => {
    for (const s of SECTIONS) expect(pathForSection(s.key)).toMatch(/^\//);
  });
});
