// v71 -- graceful behavior when the app is deployed BEFORE its database
// migration. The docs say to run migrations first, but a mistake here
// shouldn't turn into a broken app: where a v71 column is only an extra,
// the query is retried without it so the screen still loads (with v70.2
// behavior) instead of showing "couldn't load".

// Postgres 42703 = undefined_column; PostgREST words it a few ways.
export function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist|could not find .* column/i.test(error?.message || "");
}

// Runs `withColumns()`; if it fails only because a new column doesn't exist
// yet, runs `withoutColumns()` instead.
export async function withColumnFallback(withColumns, withoutColumns) {
  const first = await withColumns();
  if (first?.error && isMissingColumn(first.error)) return withoutColumns();
  return first;
}
