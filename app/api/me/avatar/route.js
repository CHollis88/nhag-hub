import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { ensureBucket } from "@/lib/storage";
import { avatarPathFromUrl } from "@/lib/avatars";

// Your own profile photo. The phone shrinks it to a small square before
// uploading (about 20 KB), so this accepts small images only.
const BUCKET = "avatars";
const MAX_BYTES = 400 * 1024;
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png"];

async function currentAvatar(supabase, userId) {
  const { data, error } = await supabase.from("users").select("avatar_url").eq("id", userId).maybeSingle();
  if (error) throw new Error(/avatar_url/.test(error.message) ? "Profile photos need the v71.29 database update (migration 040)." : error.message);
  return data?.avatar_url || null;
}

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No photo provided." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Photo must be a JPEG, PNG or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large." }, { status: 400 });

  const supabase = supabaseServer();
  let previous;
  try {
    previous = await currentAvatar(supabase, user.id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  await ensureBucket(supabase, BUCKET, { isPublic: true });

  // A new file name each time, so phones never show an old cached photo.
  const ext = file.type.split("/")[1];
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await supabase.from("users").update({ avatar_url: url }).eq("id", user.id);
  if (updateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  const oldPath = avatarPathFromUrl(previous);
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);

  return NextResponse.json({ avatar_url: url });
}

export async function DELETE(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const supabase = supabaseServer();
  let previous;
  try {
    previous = await currentAvatar(supabase, user.id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const { error } = await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const oldPath = avatarPathFromUrl(previous);
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  return NextResponse.json({ ok: true });
}
