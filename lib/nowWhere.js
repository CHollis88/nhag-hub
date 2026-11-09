// v71.25 -- remembers WHERE in the app the user currently is (which ministry,
// which tab, which program) so the mini player can bring them back to it with
// one tap. Plain module state: nothing is stored or sent anywhere.
const where = { groupId: null, tab: null, programId: null };
export function setWhere(patch) { Object.assign(where, patch); }
export function getWhere() { return { ...where }; }
export const OPEN_ORIGIN_EVENT = "nhag-open-origin";
