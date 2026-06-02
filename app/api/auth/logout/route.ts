import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * Sign out user — hapus session dari cookies
 */
export async function POST() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true, message: "Logged out", data: null });
  response.cookies.delete("ldr_session_age");
  return response;
}
