import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

const BUCKET = "curriculum-materials";

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, curriculumId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete curriculum materials." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();

  const { data: item, error: fetchError } = await supabase
    .from("curriculum_materials")
    .select("id, file_url")
    .eq("id", curriculumId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Material not found." }, { status: 404 });

  // Best-effort storage cleanup -- same reasoning as program documents:
  // the row is the source of truth, so a failed storage delete doesn't
  // block removing it.
  const storagePath = item.file_url.split(`${BUCKET}/`)[1];
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }

  const { error } = await supabase.from("curriculum_materials").delete().eq("id", curriculumId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
