import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { StandaloneEmbedDetail } from "components/standalone-embed-detail"
import { getLinkedEmbedPagePath } from "lib/embed"
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
      "id, slug, title, description, views_count, upvotes_count, created_at, project_id"
    )
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle()

  if (!embed) return null

  const { data: linkedProject } = embed.project_id
    ? await client
        .from("projects")
        .select("slug")
        .eq("id", embed.project_id)
        .eq("status", "published")
        .maybeSingle()
    : { data: null }

  return { profile, embed, linkedProjectSlug: linkedProject?.slug ?? null }
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
  if (data.linkedProjectSlug) {
    redirect(getLinkedEmbedPagePath(data.linkedProjectSlug, data.embed.slug))
  }

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
