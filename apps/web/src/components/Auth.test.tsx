/**
 * Sign-in maps a bare username onto a Supabase Auth email.
 *
 * Supabase Auth is email-keyed, so "ipassion" has to become "ipassion@ipassion.co.th"
 * before it reaches signInWithPassword. Getting that wrong does not error — it
 * authenticates against an account that does not exist and returns "Invalid login
 * credentials", which reads to the operator as a wrong password. So the mapping is the
 * whole feature, and it is tested directly rather than through a render.
 */
import { describe, it, expect } from "vitest";
import { signInErrorMessage, usernameToEmail } from "./Auth";

describe("usernameToEmail", () => {
  it("appends the company domain to a bare username", () => {
    expect(usernameToEmail("ipassion")).toBe("ipassion@ipassion.co.th");
  });

  it("leaves a full email alone", () => {
    expect(usernameToEmail("someone@elsewhere.com")).toBe("someone@elsewhere.com");
  });

  it("trims whitespace, which a paste routinely carries", () => {
    expect(usernameToEmail("  ipassion  ")).toBe("ipassion@ipassion.co.th");
    expect(usernameToEmail(" a@b.com ")).toBe("a@b.com");
  });

  it("treats anything containing @ as already an address, even oddly placed", () => {
    // Deliberate: the rule is "contains @", not "looks like an email". A stricter rule
    // would silently mangle a real address the domain check did not anticipate.
    expect(usernameToEmail("weird@")).toBe("weird@");
  });

  it("does not double-append", () => {
    const once = usernameToEmail("ipassion");
    expect(usernameToEmail(once)).toBe(once);
  });
});

describe("signInErrorMessage", () => {
  it("turns Supabase's ambiguous message into one an operator can act on", () => {
    expect(signInErrorMessage("Invalid login credentials")).toBe(
      "Username or password is incorrect.",
    );
  });

  it("matches regardless of case, because the wording has changed upstream before", () => {
    expect(signInErrorMessage("invalid login CREDENTIALS")).toMatch(/incorrect/);
  });

  it("shows every other error verbatim rather than hiding it behind a generic sentence", () => {
    for (const raw of ["Email logins are disabled", "Failed to fetch", "rate limit exceeded"]) {
      expect(signInErrorMessage(raw)).toBe(raw);
    }
  });
});
