/**
 * The zero-row write is the whole point.
 *
 * Row-level security turns a forbidden UPDATE or DELETE into a match of zero rows,
 * not an error, so `if (error)` passes and the app shows a green toast for an action
 * that did nothing. Three of the four deployment actions shipped that way.
 */
import { describe, it, expect } from "vitest";
import { mustWrite, NoRowsAffected } from "./writes";

const ok = <T,>(rows: T[]) => Promise.resolve({ data: rows, error: null });
const fails = (message: string) => Promise.resolve({ data: null, error: { message } });

describe("mustWrite", () => {
  it("returns the affected rows when the write touched something", async () => {
    await expect(mustWrite(ok([{ id: "a" }]), "Setting the default")).resolves.toEqual([{ id: "a" }]);
  });

  it("throws NoRowsAffected on an empty result — the case `if (error)` cannot see", async () => {
    await expect(mustWrite(ok([]), "Setting the default")).rejects.toBeInstanceOf(NoRowsAffected);
  });

  it("throws on a null result too", async () => {
    await expect(mustWrite(Promise.resolve({ data: null, error: null }), "Deleting the run"))
      .rejects.toBeInstanceOf(NoRowsAffected);
  });

  it("names what was attempted, so the toast is actionable", async () => {
    await expect(mustWrite(ok([]), "Cancelling this run")).rejects.toThrow(/Cancelling this run/);
  });

  it("points at permissions, because that is what a zero-row write usually means here", async () => {
    await expect(mustWrite(ok([]), "x")).rejects.toThrow(/admin/i);
  });

  it("still surfaces a real database error unchanged", async () => {
    await expect(mustWrite(fails("violates foreign key constraint"), "Deleting the run"))
      .rejects.toThrow("violates foreign key constraint");
  });

  it("does not swallow a foreign-key message, which the delete path matches on", async () => {
    // RunDetail decides between "undeploy the version first" and a raw message by
    // testing for /foreign key|violates|constraint/. That only works if the text survives.
    await expect(mustWrite(fails("update or delete on table violates foreign key"), "Deleting the run"))
      .rejects.toThrow(/foreign key/);
  });
});
