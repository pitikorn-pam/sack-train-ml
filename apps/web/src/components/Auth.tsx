import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="panel">
        <h2>Check your email</h2>
        <p>A sign-in link was sent to <code>{email}</code>.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Sign in</h2>
      <form onSubmit={submit} className="stack">
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
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button type="button" onClick={() => supabase.auth.signOut()}>
      Sign out
    </button>
  );
}
