import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";
import { storagePathFrom, createSignedUrl } from "@/lib/storage";

const BUCKET = "curriculum-materials";

// v71 #18 -- the ONLY way to open a curriculum material. Private bucket:
// membership check, then a redirect to a 60-second signed link.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, curriculumId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: item, error } = await supabase
    .from("curriculum_materials")
    .select("file_url")
    .eq("id", curriculumId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = storagePathFrom(BUCKET, item?.file_url);
  if (!path) return NextResponse.json({ error: "Material not found." }, { status: 404 });

  const url = await createSignedUrl(supabase, BUCKET, path);
  if (!url) return NextResponse.json({ error: "That file couldn't be opened. It may have been removed." }, { status: 404 });

  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
