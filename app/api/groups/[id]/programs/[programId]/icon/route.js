import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

// Reuses the same "group-icons" Storage bucket a ministry's own icon
// lives in, rather than creating a whole separate bucket for what's
// conceptually the same kind of asset (a small icon image) -- just
// prefixed "program-" so a program's file never collides with its
// parent group's own icon path.
const BUCKET = "group-icons";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

let bucketReady = false;
async function ensureBucket(supabase) {
  if (bucketReady) return;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  bucketReady = true;
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can change a program's icon." },
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

  // Confirm the program actually belongs to this group before touching
  // storage or the DB -- same defensive check every program sub-route
  // does via .eq("group_id", groupId) on its query.
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id")
    .eq("id", programId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 });
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  await ensureBucket(supabase);

  const ext = file.type.split("/")[1];
  const path = `program-${programId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("programs")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", programId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ image_url: imageUrl });
}
