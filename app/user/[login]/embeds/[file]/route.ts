import type { EmbedTheme } from "lib/embed"
import { renderCustomEmbedImage } from "lib/embed-image"
import { createPublicServerClient } from "lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ login: string; file: string }> }
) {
  const { login, file } = await params
  const match = file.match(/^([a-zA-Z0-9_-]+)(?:\.theme-(dark))?\.png$/)
  if (!match) return new Response("Not found", { status: 404 })

  const [, embedSlug, darkTheme] = match
  const client = createPublicServerClient()
  const { data: profiles } = await client.rpc("get_public_profiles", {
    p_profile_slug: login,
  })
  const profile = profiles?.[0]

  if (!profile) return new Response("Not found", { status: 404 })

  const { data: embed } = await client
    .from("standalone_embeds")
    .select("title, description")
    .eq("owner_id", profile.id)
    .eq("slug", embedSlug)
    .eq("status", "approved")
    .maybeSingle()

  if (!embed) return new Response("Not found", { status: 404 })

  const theme: EmbedTheme = darkTheme ? "dark" : "light"
  const response = await renderCustomEmbedImage(
    embed.title,
    embed.description,
    theme
  )
  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
  )
  return response
}
