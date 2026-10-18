import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { StandaloneEmbedDetail } from "components/standalone-embed-detail"
import { siteConfig } from "lib/site"
import { createPublicServerClient } from "lib/supabase/server"

export const dynamic = "force-dynamic"

async function getEmbed(slug: string, embedSlug: string) {
  const client = createPublicServerClient()
  const { data: project } = await client
    .from("projects")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
  if (!project) return null

  const { data: embed } = await client
    .from("standalone_embeds")
    .select(
      "id, owner_id, slug, title, description, views_count, upvotes_count, created_at"
    )
    .eq("project_id", project.id)
    .eq("slug", embedSlug)
    .eq("status", "approved")
    .maybeSingle()

  if (!embed) return null

  const { data: profiles } = await client.rpc("get_public_profiles", {
    p_profile_ids: [embed.owner_id],
  })

  return { project, embed, profile: profiles?.[0] ?? null }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; embedSlug: string }>
}): Promise<Metadata> {
  const { slug, embedSlug } = await params
  const data = await getEmbed(slug, embedSlug)
  if (!data) return { title: "Embed not found" }

  return {
    title: `${data.embed.title} - ${data.project.name}`,
    description: data.embed.description || `Embed on ${siteConfig.name}.`,
  }
}

export default async function ProjectEmbedPage({
  params,
}: {
  params: Promise<{ slug: string; embedSlug: string }>
}) {
  const { slug, embedSlug } = await params
  const data = await getEmbed(slug, embedSlug)
  if (!data) notFound()

  return (
    <StandaloneEmbedDetail
      profileSlug={data.profile?.slug}
      author={
        data.profile
          ? {
              displayName: data.profile.display_name || data.profile.slug,
              avatarUrl: data.profile.avatar_url,
            }
          : undefined
      }
      project={{ slug: data.project.slug, name: data.project.name }}
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
