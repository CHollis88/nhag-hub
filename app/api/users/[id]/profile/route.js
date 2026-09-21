import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withPublicCache } from "@/lib/cacheHeaders";

// Any signed-in user can view another member's profile card -- bio,
// location, and interests are all opt-in self-disclosed fields, not
// sensitive data, so this deliberately has no group-membership check
// (mirrors how the Directory already shows every ministry's leaders
// church-wide). Never returns email or auth-related fields.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id } = await params;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, bio, location, interests")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return withPublicCache({ profile: data }, { maxAge: 300, staleWhileRevalidate: 3600 });
}
