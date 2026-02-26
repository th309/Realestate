import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const newsletterSignupSchema = z.object({
  email: z.string().email("Invalid email address").max(320),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = newsletterSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email } = parsed.data;

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("newsletter_signups")
    .upsert(
      { email: email.toLowerCase(), subscribed_at: new Date().toISOString() },
      { onConflict: "email" },
    );

  if (error) {
    console.error("Newsletter signup error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
