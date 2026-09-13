import { SESSION_COOKIE_NAME, getUserForSessionToken } from "@/lib/session";

// The one function every API route should call first. Returns the full
// user row (including is_church_admin) for the request's session cookie,
// or null if there isn't a valid session. This is the single source of
// truth for "who is making this request" — nothing downstream should trust
// a user_id passed in the request body for identity purposes.
export async function getCurrentUser(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getUserForSessionToken(token);
}

// True if this user's profile setup (username + display name) is done.
// A user row exists the moment a magic link is first verified, but isn't
// "complete" until they've chosen a username.
export function isProfileComplete(user) {
  return Boolean(user?.username);
}
