import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { withPrivateCache } from "@/lib/cacheHeaders";
import crypto from "crypto";

// Same bucket-per-content-type pattern as program-documents -- PDFs are
// a distinct content type from icons, so this stays its own bucket.
const BUCKET = "curriculum-materials";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf"];

let bucketReady = false;
async function ensureBucket(supabase) {
  if (bucketReady) return;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  bucketReady = true;
}

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("curriculum_materials")
    .select("id, title, description, file_url, created_at, users(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ materials: data }, { maxAge: 60, staleWhileRevalidate: 300 });
}

// Leader/admin only to upload -- same as programs' documents tab.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can upload curriculum materials." },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const description = formData.get("description");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 20MB." }, { status: 400 });
  }

  const supabase = supabaseServer();
  await ensureBucket(supabase);

  const path = `${groupId}/${crypto.randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from("curriculum_materials")
    .insert({
      group_id: groupId,
      title: title.trim(),
      description: description?.trim() || null,
      file_url: publicUrlData.publicUrl,
      created_by: user.id,
    })
    .select("id, title, description, file_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ material: data });
}
