import { requestJson } from "@/lib/request";
import { fetchResource, STALE } from "@/lib/resourceCache";

// Every PostReactions on screen asks for its post's reactions; the asks made
// in the same moment are gathered into ONE request (/api/reactions), and each
// post's answer is kept in the shared screen cache, so a list you come back
// to shows its reactions at once.
export const reactionsKey = (type, id) => `reactions:${type}:${id}`;

const pending = new Map(); // type -> Map(id -> { resolve, reject })
let timer = null;

function flush() {
  timer = null;
  const batches = [...pending.entries()];
  pending.clear();
  for (const [type, waiting] of batches) {
    const ids = [...waiting.keys()];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      requestJson(`/api/reactions?type=${type}&ids=${chunk.map(encodeURIComponent).join(",")}`)
        .then((data) => chunk.forEach((id) => waiting.get(id).resolve(data.reactions?.[id] || [])))
        .catch((err) => chunk.forEach((id) => waiting.get(id).reject(err)));
    }
  }
}

function askBatched(type, id) {
  return new Promise((resolve, reject) => {
    if (!pending.has(type)) pending.set(type, new Map());
    pending.get(type).set(id, { resolve, reject });
    if (!timer) timer = setTimeout(flush, 15);
  });
}

export function loadReactions(type, id) {
  return fetchResource(reactionsKey(type, id), () => askBatched(type, id), { staleMs: STALE.list });
}
