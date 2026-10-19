import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { storagePathFrom, createSignedUrl } from "@/lib/storage";

const BUCKET = "program-documents";

// v71 #18 -- the ONLY way to open a program document. The bucket is
// private, so there is no permanent link to a file. This checks that the
// person is a member of the ministry, then redirects to a signed link that
// expires in 60 seconds. Opened with a plain <a href target="_blank">.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, documentId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();

  // The program must belong to THIS group, and a hidden program is only
  // reachable by its managers (same rule as the program's own GET).
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, hidden")
    .eq("id", programId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 });
  if (!program || (program.hidden && !(await canManageGroup(user, groupId)))) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: doc, error } = await supabase
    .from("program_documents")
    .select("file_url")
    .eq("id", documentId)
    .eq("program_id", programId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = storagePathFrom(BUCKET, doc?.file_url);
  if (!path) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const url = await createSignedUrl(supabase, BUCKET, path);
  if (!url) return NextResponse.json({ error: "That file couldn't be opened. It may have been removed." }, { status: 404 });

  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
