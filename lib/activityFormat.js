// v71 #26 -- turns an activity-log row into ONE readable sentence
// ("Cam approved Taylor's request to join Choir"), keeping the raw fields
// available to expand.
//
// New entries are written as complete sentences that already start with the
// actor's name. Older entries (before v71) stored just the predicate --
// `Made @sam an admin`, `Created "Choir"` -- so those get the actor put in
// front. An entry with no text at all falls back to a plain description of
// the action.

const ACTION_TEXT = {
  admin_promoted: "made someone a Church Admin",
  admin_demoted: "removed someone's Church Admin access",
  admin_privileges_enabled: "turned Admin Privileges on",
  admin_privileges_disabled: "turned Admin Privileges off",
  admin_pin_failed: "entered a wrong PIN",
  sessions_revoked: "signed someone out on every device",
  ministry_created: "created a ministry",
  ministry_deleted: "permanently deleted a ministry",
  ministry_archived: "archived a ministry",
  ministry_restored: "restored a ministry",
  features_changed: "changed a ministry's modules",
  join_request_approved: "approved a request to join a ministry",
  join_request_rejected: "rejected a request to join a ministry",
  user_ministry_blocked: "blocked someone from a ministry",
  user_ministry_unblocked: "unblocked someone from a ministry",
};

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

export function formatActivityEntry(entry) {
  const actor = entry.users?.display_name || "Someone";
  const details = (entry.details || "").trim();

  let line;
  if (details) {
    line = details.toLowerCase().startsWith(actor.toLowerCase()) ? details : `${actor} ${lowerFirst(details)}`;
  } else {
    line = `${actor} ${ACTION_TEXT[entry.action] || String(entry.action || "did something").replace(/_/g, " ")}`;
  }

  return {
    id: entry.id,
    line,
    created_at: entry.created_at,
    // Shown when a line is expanded.
    raw: { action: entry.action, actor, details: entry.details || null, meta: entry.meta || null },
  };
}
