// v71 -- who wrote this? Content outlives the people who wrote it: when an
// admin deletes an account, the person's news posts, replies, prayer
// requests and group-chat messages STAY, with the author left blank
// (migration_036). Anywhere a name is shown for such content, an empty author
// is displayed as "Former member" rather than a blank space or "undefined".
export const FORMER_MEMBER = "Former member";

export function authorName(user) {
  const name = user?.display_name;
  return typeof name === "string" && name.trim() ? name : FORMER_MEMBER;
}
