// v71 #15 / #18 -- shared Supabase Storage helpers.

// Creates the bucket the first time it's needed (no manual dashboard step),
// and for a PRIVATE bucket makes sure it really is private even if it
// already exists as public -- the old code created these buckets public, so
// anyone holding a file's URL could read it without signing in.
//
// Never the reverse: a bucket that's meant to be public is left as found.
const ready = new Set();
export async function ensureBucket(supabase, name, { isPublic }) {
  if (ready.has(name)) return;
  const { error } = await supabase.storage.createBucket(name, { public: isPublic });
  if (error && /already exists|duplicate|resource already/i.test(error.message || "")) {
    if (!isPublic) {
      const { data: bucket } = await supabase.storage.getBucket(name);
      if (bucket && bucket.public) {
        await supabase.storage.updateBucket(name, { public: false }).catch(() => {});
      }
    }
  }
  ready.add(name);
}

// What's stored in a `file_url` column is now the OBJECT PATH inside its
// private bucket ("<programId>/<uuid>.pdf"). Older rows hold a full public
// URL ("https://.../object/public/<bucket>/<path>"); this accepts both so
// nothing needs migrating.
export function storagePathFrom(bucket, stored) {
  if (!stored) return null;
  if (!/^https?:\/\//i.test(stored)) return stored;
  const marker = `/${bucket}/`;
  const at = stored.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(stored.slice(at + marker.length).split("?")[0]);
}

// Best-effort delete. Cleanup must never mask the real error that made
// cleanup necessary, so this never throws.
export async function removeQuietly(supabase, bucket, paths) {
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (!list.length) return;
  try {
    await supabase.storage.from(bucket).remove(list);
  } catch {
    // Deliberately swallowed.
  }
}

// Runs `work` (the database step that follows an upload). If it fails --
// returns { error } or throws -- the just-uploaded object is deleted so a
// failed save doesn't leave an orphan file in storage forever. `createdNew`
// must be false when the upload overwrote an object that already existed
// (icons), since deleting it then would remove the file the database still
// points at.
export async function cleanupUploadOnFailure(supabase, bucket, path, work, { createdNew = true } = {}) {
  let result;
  try {
    result = await work();
  } catch (err) {
    if (createdNew) await removeQuietly(supabase, bucket, path);
    throw err;
  }
  if (result?.error && createdNew) await removeQuietly(supabase, bucket, path);
  return result;
}

// Short-lived link to a private file. 60 s is plenty for the browser to
// start the download right after the redirect, and useless if it leaks.
export const SIGNED_URL_SECONDS = 60;
export async function createSignedUrl(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
