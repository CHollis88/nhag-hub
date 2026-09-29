import { NextResponse } from "next/server";

// Maps a Postgres-function (supabase.rpc) failure to an API response.
//
// migration_034 / 035 must be applied before v71 is deployed. If someone
// deploys first, PostgREST answers PGRST202 ("function not found") -- say
// so plainly instead of a bare 500 that looks like a random bug.
//
// `known` maps a SQLSTATE (the function's own error codes, e.g. NH002) to
// { status, message } for errors that are the CALLER's fault.
export function rpcFailure(error, known = {}) {
  const hit = known[error?.code];
  if (hit) return NextResponse.json({ error: hit.message }, { status: hit.status });

  if (error?.code === "PGRST202" || error?.code === "42883" || /could not find the function/i.test(error?.message || "")) {
    return NextResponse.json(
      { error: "This feature needs a database update that hasn't been applied yet (v71 migrations 034/035). Ask the admin to run them." },
      { status: 500 }
    );
  }
  return NextResponse.json({ error: error?.message || "Something went wrong." }, { status: 500 });
}
