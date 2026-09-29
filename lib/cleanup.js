// v71 #16 -- deleting old rows safely, in bounded batches.
//
// The cron job used to (1) ignore every error, so a failed delete looked
// exactly like "nothing to delete" and was reported as ok; (2) load EVERY
// expired message id into memory at once; and (3) put all those ids into a
// single .in() filter -- which breaks on the URL-length limit once there are
// a few hundred. This deletes a bounded batch at a time, checks the result
// of every step, and reports precisely what happened.
//
// One task = one table + the date column that decides expiry. If the rows
// have reactions that live in a shared table with no foreign key, those are
// removed first, batch by batch, so a failure part-way never leaves
// reactions pointing at messages that are already gone... and never deletes
// a message whose reactions couldn't be removed.

// 100 uuids per .in() keeps the request well under URL-length limits (the
// same figure lib/batchFetch.js uses for the same reason).
export const BATCH_SIZE = 100;

/**
 * @param supabase
 * @param {object} task
 * @param {string} task.table        table to purge
 * @param {string} task.column       timestamp/date column
 * @param {string} task.cutoff       delete rows where column < cutoff
 * @param {object} [task.reactions]  { table, typeColumn, type, idColumn }
 * @param {number} [opts.maxBatches] safety cap per task per run
 * @param {number} [opts.deadline]   Date.now() value after which to stop
 * @returns {{ deleted: number, complete: boolean, error: string|null }}
 *   complete=false means it stopped early (cap/deadline) and more remains --
 *   tomorrow's run continues. error is set if a step FAILED.
 */
export async function purgeInBatches(supabase, task, { maxBatches = 100, deadline = Infinity } = {}) {
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    if (Date.now() > deadline) return { deleted, complete: false, error: null };

    const { data: rows, error: selectError } = await supabase
      .from(task.table)
      .select("id")
      .lt(task.column, task.cutoff)
      .order(task.column, { ascending: true })
      .limit(BATCH_SIZE);
    if (selectError) return { deleted, complete: false, error: `${task.table}: could not list expired rows (${selectError.message})` };

    const ids = (rows || []).map((r) => r.id);
    if (ids.length === 0) return { deleted, complete: true, error: null };

    if (task.reactions) {
      const { table, typeColumn, type, idColumn } = task.reactions;
      const { error: reactionError } = await supabase.from(table).delete().eq(typeColumn, type).in(idColumn, ids);
      if (reactionError) {
        // Do NOT delete the messages: their reactions would be orphaned.
        return { deleted, complete: false, error: `${task.table}: could not remove reactions (${reactionError.message})` };
      }
    }

    const { error: deleteError } = await supabase.from(task.table).delete().in("id", ids);
    if (deleteError) return { deleted, complete: false, error: `${task.table}: delete failed (${deleteError.message})` };

    deleted += ids.length;
    if (ids.length < BATCH_SIZE) return { deleted, complete: true, error: null };
  }

  return { deleted, complete: false, error: null }; // hit maxBatches; more may remain
}
