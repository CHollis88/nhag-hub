import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

const BUCKET = "group-icons";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

let bucketReady = false;
async function ensureBucket(supabase) {
  if (bucketReady) return;
  // Idempotent -- if it already exists this just errors quietly and we
  // move on. Avoids a manual "create this bucket in the dashboard" setup
  // step, matching how the rest of this app is just SQL files to run.
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  bucketReady = true;
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can change its icon." },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Image must be PNG, JPEG, or WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }

  const supabase = supabaseServer();
  await ensureBucket(supabase);

  const ext = file.type.split("/")[1];
  const path = `${groupId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so the new icon shows immediately even though the path
  // (and therefore the URL) is identical to whatever was there before.
  const imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("groups")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", groupId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ image_url: imageUrl });
}
