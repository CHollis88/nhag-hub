import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember, assertInGroup } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";
import { ensureBucket, cleanupUploadOnFailure } from "@/lib/storage";
import crypto from "crypto";

// Separate bucket from group-icons/program icons -- PDFs are a
// genuinely different content type (bigger files, different MIME
// allowlist) so this stays its own bucket rather than overloading
// group-icons the way program icons reuse it. Same idempotent
// create-on-first-use pattern, no manual dashboard step.
//
// PRIVATE (v71 #18): ministry documents are for members only. The bucket
// is created private, `file_url` stores the object PATH (not a public
// URL), and files are only reachable through
// .../documents/[documentId]/download, which checks membership and then
// redirects to a 60-second signed link.
const BUCKET = "program-documents";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB -- PDFs run bigger than icon images
const ALLOWED_TYPES = ["application/pdf"];

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_documents")
    .select("id, title, created_at, users(display_name)")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ documents: data });
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

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
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

  await ensureBucket(supabase, BUCKET, { isPublic: false });

  // A random suffix (not just programId) since a program can hold many
  // documents, unlike an icon where one file replaces the last.
  const path = `${programId}/${crypto.randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // v71 #15: if the database insert fails, delete the file we just
  // uploaded -- otherwise every failed save leaves an orphan PDF behind.
  const { data, error } = await cleanupUploadOnFailure(supabase, BUCKET, path, () =>
    supabase
      .from("program_documents")
      .insert({
        program_id: programId,
        title: title.trim(),
        file_url: path, // the object path in the private bucket
        uploaded_by: user.id,
      })
      .select("id, title, created_at")
      .single()
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
