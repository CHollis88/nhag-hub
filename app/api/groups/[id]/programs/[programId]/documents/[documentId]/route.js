import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, assertInGroup } from "@/lib/groupAuth";
import { storagePathFrom, removeQuietly } from "@/lib/storage";

const BUCKET = "program-documents";

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, documentId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete documents." },
      { status: 403 }
    );
  }

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const supabase = supabaseServer();

  const { data: doc, error: fetchError } = await supabase
    .from("program_documents")
    .select("id, file_url")
    .eq("id", documentId)
    .eq("program_id", programId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Best-effort storage cleanup -- the row is the source of truth for
  // "does this document exist," so a failed storage delete (network
  // blip, file already gone) shouldn't block removing the row itself.
  await removeQuietly(supabase, BUCKET, storagePathFrom(BUCKET, doc.file_url));

  const { error } = await supabase.from("program_documents").delete().eq("id", documentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
