import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";

// Username login maps to a Supabase Auth email under this domain. Supabase Auth
// is email-keyed; we let users type a bare username (e.g. "ipassion") and append
// the domain so the credential DB (auth.users, bcrypt-hashed) stays the single
// source of truth. A value already containing "@" is treated as a full email.
const USERNAME_DOMAIN = "ipassion.co.th";

function usernameToEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${v}@${USERNAME_DOMAIN}`;
}

export function useSession(): Session | null | "loading" {
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}

export function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange in useSession picks up the new session.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Supabase returns "Invalid login credentials" for both wrong user + pw.
      setError(/invalid login credentials/i.test(msg) ? "Username or password is incorrect." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel auth-panel">
      <h2>Sign in</h2>
      <p className="muted">Enter your BSCP credentials to continue.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ipassion"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button primary" disabled={loading}>
          <LogIn size={14} strokeWidth={2} />
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button type="button" className="button" onClick={() => supabase.auth.signOut()}>
      <LogOut size={14} strokeWidth={2} />
      Sign out
    </button>
  );
}
