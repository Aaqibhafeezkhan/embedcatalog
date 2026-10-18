import { createHmac } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import type { Database } from "lib/supabase/database"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const emailValue =
    typeof payload === "object" &&
    payload !== null &&
    "email" in payload &&
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : ""

  if (emailValue.length > 254 || !emailPattern.test(emailValue)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Newsletter API is missing Supabase server configuration.")
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const clientIp =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  if (clientIp) {
    const keyHash = createHmac("sha256", serviceRoleKey)
      .update(`newsletter-ip:${clientIp}`)
      .digest("hex")
    const { data: allowed, error: rateLimitError } = await supabase.rpc(
      "consume_newsletter_rate_limit",
      {
        p_key_hash: keyHash,
        p_max_attempts: 20,
        p_window_seconds: 60 * 60,
      }
    )

    if (rateLimitError) {
      console.error("Newsletter rate limit check failed:", rateLimitError.code)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    if (!allowed) return NextResponse.json({ ok: true }, { status: 200 })
  }

  const { error } = await supabase
    .from("newsletter_subscriptions")
    .upsert(
      { email: emailValue },
      { onConflict: "email", ignoreDuplicates: true }
    )

  if (error) {
    console.error("Newsletter subscription could not be saved:", error.code)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
