import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { withPrivateCache } from "@/lib/cacheHeaders";
import crypto from "crypto";

// Separate bucket from group-icons/program icons -- PDFs are a
// genuinely different content type (bigger files, different MIME
// allowlist) so this stays its own bucket rather than overloading
// group-icons the way program icons reuse it. Same idempotent
// create-on-first-use pattern, no manual dashboard step.
const BUCKET = "program-documents";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB -- PDFs run bigger than icon images
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

  const { id: groupId, programId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_documents")
    .select("id, title, file_url, created_at, users(display_name)")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ documents: data });
}

// Uploading a document is leader/admin territory, same as everything
// else about managing a program's content -- members view, not upload.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can upload documents." },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = formData.get("title");
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

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id")
    .eq("id", programId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 });
  if (!program) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  await ensureBucket(supabase);

  // A random suffix (not just programId) since a program can hold many
  // documents, unlike an icon where one file replaces the last.
  const path = `${programId}/${crypto.randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from("program_documents")
    .insert({
      program_id: programId,
      title: title.trim(),
      file_url: publicUrlData.publicUrl,
      uploaded_by: user.id,
    })
    .select("id, title, file_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
