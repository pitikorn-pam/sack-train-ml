/**
 * Writes that cannot report success without having written anything.
 *
 * Row-level security makes a forbidden write *match zero rows* rather than fail:
 * `supabase/migrations/20260526100006_rls.sql` grants the SQL privilege to
 * `authenticated` and then gates the rows behind `public.is_admin()`. PostgREST
 * returns no error for a zero-row UPDATE or DELETE, so the usual
 *
 *     const { error } = await supabase.from(t).update(x).eq("id", id);
 *     if (error) ...; else toast("Done");
 *
 * shows a green toast for an action that did nothing. Three of this app's four
 * deployment actions were written that way.
 *
 * The fix is not a better error check — there is no error. It is to ask the write
 * what it touched, which requires `.select(...)` on the query, and to treat an empty
 * result as the failure it is.
 */

type WriteResult<T> = { data: T[] | null; error: { message: string } | null };

export class NoRowsAffected extends Error {
  constructor(what: string) {
    super(
      `${what} matched no rows. Under row-level security a write you are not permitted ` +
        `to make matches zero rows rather than failing, so this is most likely a permissions ` +
        `problem — check you are signed in as an admin — or the record no longer exists.`,
    );
    this.name = "NoRowsAffected";
  }
}

/**
 * Await a Supabase write that has `.select(...)` on it, and refuse to call a
 * zero-row result a success.
 *
 * @param q     the query builder, with `.select(...)` already applied
 * @param what  what was being attempted, phrased as a noun for the message
 */
export async function mustWrite<T>(q: PromiseLike<WriteResult<T>>, what: string): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new NoRowsAffected(what);
  return data;
}
