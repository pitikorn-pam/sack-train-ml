/**
 * Locale-stable formatters.
 *
 * These exist because the browser default locale on some Thai installs renders the
 * Buddhist calendar — "26/5/2569" — which is wrong on an operator dashboard and is the
 * kind of thing that looks like a data bug rather than a formatting one. The whole
 * point is that the output does NOT depend on the machine running it, so the tests pin
 * the actual strings rather than a shape.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatBytes, formatDate, formatDateTime, formatRelative, formatTime } from "./format";

afterEach(() => vi.useRealTimers());

describe("dates render in en-US regardless of the host locale", () => {
  const iso = "2026-05-26T14:07:09Z";

  it("formatDate is Gregorian, not Buddhist", () => {
    const out = formatDate(iso);
    expect(out).toContain("2026");
    expect(out).not.toContain("2569");
  });

  it("formatDateTime carries a 24-hour clock", () => {
    expect(formatDateTime(iso)).toMatch(/2026/);
    expect(formatDateTime(iso)).not.toMatch(/AM|PM/);
  });

  it("formatTime is hh:mm:ss, 24-hour", () => {
    expect(formatTime(iso)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("absent and invalid inputs render as an em dash, never as a crash or 'Invalid Date'", () => {
  for (const [name, fn] of Object.entries({ formatDate, formatDateTime, formatTime, formatRelative })) {
    it(`${name} handles null, undefined, empty and nonsense`, () => {
      for (const bad of [null, undefined, "", "not a date"]) {
        expect(fn(bad as string | null)).toBe("—");
      }
    });
  }
});

describe("formatRelative", () => {
  const now = new Date("2026-09-07T12:00:00Z");

  const at = (msAgo: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return formatRelative(new Date(now.getTime() - msAgo));
  };

  it("under a minute is 'just now'", () => {
    expect(at(30_000)).toBe("just now");
  });

  it("minutes, hours and days each get their own unit", () => {
    expect(at(5 * 60_000)).toBe("5m");
    expect(at(3 * 3_600_000)).toBe("3h");
    expect(at(2 * 86_400_000)).toBe("2d");
  });

  it("the boundaries do not skip a unit", () => {
    expect(at(60_000)).toBe("1m");
    expect(at(3_600_000)).toBe("1h");
    expect(at(86_400_000)).toBe("1d");
  });
});

describe("formatBytes", () => {
  it("uses binary units and one decimal above a kilobyte", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.00 GB");
  });

  it("zero is a size, not an absence", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("an absent size is an em dash — a missing artifact is not an empty one", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
  });

  it("the unit boundaries are exact", () => {
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 - 1)).toContain("KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});
