import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Returns the current user plus every group they have an active or pending
// relationship with. This is for client-side UI decisions (which nav items
// to show, etc.) only — every mutating route re-checks authority itself and
// never trusts anything the client infers from this response.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const supabase = supabaseServer();
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, role, status, groups(id, name, type, features, image_url, tile_color)")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      is_church_admin: user.is_church_admin,
    },
    memberships: (memberships || []).map((m) => ({
      group_id: m.group_id,
      role: m.role,
      status: m.status,
      group: m.groups,
    })),
  });
}
