// Fetch every row of `table` whose `column` is in `ids`, in as few
// Supabase requests as possible.
//
// Replaces the "one query per item" pattern (e.g. one RSVP query per
// event) that made each Events/Calendar load cost N requests -- the
// single biggest source of Supabase log volume after auth.
//
// Two limits it respects:
//   * ids are chunked (100 per request) so the query string stays well
//     under URL length limits even with long recurring-event lists;
//   * each chunk is paged 1,000 rows at a time, since PostgREST caps a
//     single response at 1,000 rows by default.
const CHUNK = 100;
const PAGE = 1000;

export async function fetchByIds(supabase, table, column, ids, select) {
  const unique = [...new Set(ids)].filter(Boolean);
  const rows = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in(column, chunk)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

/** Group rows into a Map keyed by row[column]. */
export function groupBy(rows, column) {
  const map = new Map();
  for (const r of rows) {
    const k = r[column];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}
