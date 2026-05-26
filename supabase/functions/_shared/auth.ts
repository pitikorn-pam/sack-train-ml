// =============================================================================
// _shared/auth.ts — JWT role/claims helpers
// =============================================================================

interface Claims {
  role?: string;
  app_metadata?: { role?: string };
  [k: string]: unknown;
}

export function claimsFromJwt(token: string | null): Claims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Claims;
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function isAdmin(req: Request): boolean {
  const claims = claimsFromJwt(bearerToken(req));
  if (!claims) return false;
  return claims.role === "service_role" || claims.app_metadata?.role === "admin";
}

/**
 * Any valid signed-in user (magic-link, password, or service_role).
 * Use for non-destructive operations (start-training, upload-dataset, etc.)
 * where any operator-grade user is acceptable.
 *
 * RLS on the underlying tables still enforces per-row authorization.
 */
export function isAuthenticated(req: Request): boolean {
  const claims = claimsFromJwt(bearerToken(req));
  if (!claims) return false;
  return (
    claims.role === "service_role" ||
    claims.role === "authenticated" ||
    claims.app_metadata?.role === "admin"
  );
}
