import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Star, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";

export function useSession(): Session | null | "loading" {
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}

const QUICK_USERS = [
  { label: "admin@bscp.local", email: "admin@bscp.local", password: "admin1234", role: "admin" as const },
  { label: "user@bscp.local",  email: "user@bscp.local",  password: "user1234",  role: "authenticated" as const },
];

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function quickSignIn(email: string, password: string) {
    setError(null);
    setLoading(email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function sendMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <>
      <div className="panel">
        <h2>Quick sign in (dev)</h2>
        <p className="muted">Pre-seeded test users — one click to enter.</p>
        <div className="quick-users">
          {QUICK_USERS.map((u) => (
            <button
              key={u.email}
              className={`quick-user quick-user-${u.role}`}
              onClick={() => quickSignIn(u.email, u.password)}
              disabled={loading === u.email}
              type="button"
            >
              <div className="quick-user-role">
                {u.role === "admin" && <Star size={11} fill="currentColor" strokeWidth={0} />}
                {u.role === "admin" ? "admin" : "authenticated"}
              </div>
              <code>{u.label}</code>
              <div className="quick-user-hint">
                {loading === u.email ? "Signing in…" : "click to sign in"}
              </div>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <details className="panel">
        <summary><strong>Or sign in with magic link</strong></summary>
        {sent ? (
          <p>A sign-in link was sent to <code>{email}</code>.</p>
        ) : (
          <form onSubmit={sendMagic} className="stack">
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ipassion.co.th"
              />
            </label>
            <button type="submit">Send magic link</button>
          </form>
        )}
      </details>
    </>
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
