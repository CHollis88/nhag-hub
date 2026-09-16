import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

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
  const storagePath = doc.file_url.split(`${BUCKET}/`)[1];
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }

  const { error } = await supabase.from("program_documents").delete().eq("id", documentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
