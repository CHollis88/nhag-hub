import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyAdmins } from "@/lib/push";

// Any signed-in member can submit feedback, optionally anonymous, about
// a specific group or the church/app generally (group_id omitted).
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { group_id, message, is_anonymous } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Feedback message can't be empty." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      group_id: group_id || null,
      created_by: user.id,
      is_anonymous: Boolean(is_anonymous),
      message: message.trim(),
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyAdmins({ title: "New Feedback", body: "Tap to view.", url: "/?admin=feedback" }).catch(() => {});

  return NextResponse.json({ feedback: data });
}
