import type { EmbedTheme } from "lib/embed"
import { renderCustomEmbedImage } from "lib/embed-image"
import { resolveEmbedText } from "lib/embed-variables"
import { createPublicServerClient } from "lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> }
) {
  const { slug, file } = await params
  const match = file.match(/^([a-zA-Z0-9_-]+)(?:\.theme-(dark))?\.png$/)
  if (!match) return new Response("Not found", { status: 404 })

  const [, embedSlug, darkTheme] = match
  const client = createPublicServerClient()
  const { data: project } = await client
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!project) return new Response("Not found", { status: 404 })

  const { data: embed } = await client
    .from("standalone_embeds")
    .select("title, image_title, image_description")
    .eq("project_id", project.id)
    .eq("slug", embedSlug)
    .eq("status", "approved")
    .maybeSingle()

  if (!embed) return new Response("Not found", { status: 404 })

  const theme: EmbedTheme = darkTheme ? "dark" : "light"
  const [title, description] = await Promise.all([
    resolveEmbedText(embed.image_title || embed.title),
    resolveEmbedText(embed.image_description),
  ])
  const response = await renderCustomEmbedImage(title, description, theme)
  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
  )
  return response
}
