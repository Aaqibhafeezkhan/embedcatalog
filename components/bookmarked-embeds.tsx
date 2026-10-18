"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { CustomEmbedCard } from "components/project-embeds"
import { useAuth } from "components/auth-provider"
import { siteConfig } from "lib/site"
import { supabase } from "lib/supabase/client"

type BookmarkedEmbed = {
  id: string
  slug: string
  title: string
  profileSlug: string
  avatarUrl: string | null
  viewsCount: number
  upvotesCount: number
}

function BookmarkedEmbeds() {
  const { user } = useAuth()
  const [embeds, setEmbeds] = React.useState<BookmarkedEmbed[]>([])
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const loading = Boolean(user && loadedFor !== user.id)

  React.useEffect(() => {
    if (!user) return

    let cancelled = false
    const userId = user.id

    async function load() {
      const finish = (items: BookmarkedEmbed[], message: string | null) => {
        if (cancelled) return
        setEmbeds(items)
        setError(message)
        setLoadedFor(userId)
      }

      const { data: rows, error: rowsError } = await supabase
        .from("standalone_embed_bookmarks")
        .select("embed_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (rowsError) return finish([], rowsError.message)
      const ids = (rows ?? []).map((row) => row.embed_id)
      if (ids.length === 0) return finish([], null)

      const { data: embedRows, error: embedsError } = await supabase
        .from("standalone_embeds")
        .select("id, owner_id, slug, title, views_count, upvotes_count")
        .in("id", ids)
        .eq("status", "approved")

      if (embedsError) return finish([], embedsError.message)

      const ownerIds = [...new Set(embedRows.map((embed) => embed.owner_id))]
      const { data: profiles, error: profilesError } = ownerIds.length
        ? await supabase.rpc("get_public_profiles", {
            p_profile_ids: ownerIds,
          })
        : { data: [], error: null }

      if (profilesError) return finish([], profilesError.message)

      const profilesById = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile])
      )
      const byId = new Map(embedRows.map((embed) => [embed.id, embed]))

      finish(
        ids.flatMap((id) => {
          const embed = byId.get(id)
          const profile = embed && profilesById.get(embed.owner_id)
          if (!embed || !profile) return []

          return [
            {
              id: embed.id,
              slug: embed.slug,
              title: embed.title,
              profileSlug: profile.slug,
              avatarUrl: profile.avatar_url,
              viewsCount: embed.views_count,
              upvotesCount: embed.upvotes_count,
            },
          ]
        }),
        null
      )
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading bookmarks
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not load bookmarks: {error}
      </p>
    )
  }

  if (embeds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No bookmarked embeds yet.</p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {embeds.map((embed) => (
        <CustomEmbedCard
          key={embed.id}
          embedId={embed.id}
          slug={embed.profileSlug}
          standaloneProfileSlug={embed.profileSlug}
          standaloneSlug={embed.slug}
          projectUrl={`${siteConfig.url}/user/${encodeURIComponent(embed.profileSlug)}/embed/${encodeURIComponent(embed.slug)}`}
          title={embed.title}
          creator={{ slug: embed.profileSlug, avatarUrl: embed.avatarUrl }}
          viewsCount={embed.viewsCount}
          upvotesCount={embed.upvotesCount}
        />
      ))}
    </div>
  )
}

export { BookmarkedEmbeds }
