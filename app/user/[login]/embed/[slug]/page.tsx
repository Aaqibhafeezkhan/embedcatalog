import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { StandaloneEmbedDetail } from "components/standalone-embed-detail"
import { siteConfig } from "lib/site"
import { createPublicServerClient } from "lib/supabase/server"

export const dynamic = "force-dynamic"

async function getEmbed(login: string, slug: string) {
  const client = createPublicServerClient()
  const { data: profiles } = await client.rpc("get_public_profiles", {
    p_profile_slug: login,
  })
  const profile = profiles?.[0]
  if (!profile) return null

  const { data: embed } = await client
    .from("standalone_embeds")
    .select(
      "id, slug, title, description, views_count, upvotes_count, created_at"
    )
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle()

  return embed ? { profile, embed } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ login: string; slug: string }>
}): Promise<Metadata> {
  const { login, slug } = await params
  const data = await getEmbed(login, slug)
  if (!data) return { title: "Embed not found" }

  return {
    title: `${data.embed.title} by @${data.profile.slug}`,
    description: data.embed.description || `Embed on ${siteConfig.name}.`,
  }
}

export default async function StandaloneEmbedPage({
  params,
}: {
  params: Promise<{ login: string; slug: string }>
}) {
  const { login, slug } = await params
  const data = await getEmbed(login, slug)
  if (!data) notFound()

  return (
    <StandaloneEmbedDetail
      profileSlug={data.profile.slug}
      author={{
        displayName: data.profile.display_name || data.profile.slug,
        avatarUrl: data.profile.avatar_url,
      }}
      embed={{
        createdAt: data.embed.created_at,
        id: data.embed.id,
        slug: data.embed.slug,
        title: data.embed.title,
        description: data.embed.description,
        viewsCount: data.embed.views_count,
        upvotesCount: data.embed.upvotes_count,
      }}
    />
  )
}
