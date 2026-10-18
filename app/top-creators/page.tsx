import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowUp, Eye, UserRound } from "lucide-react"

import { createPublicServerClient } from "lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Top creators",
  description:
    "Creators ranked by the views and upvotes on their custom embeds.",
}

type CreatorStats = {
  views: number
  upvotes: number
}

async function getTopCreators() {
  const supabase = createPublicServerClient()
  const statsByOwner = new Map<string, CreatorStats>()
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("standalone_embeds")
      .select("owner_id, views_count, upvotes_count")
      .eq("status", "approved")
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error("Failed to load creator embed stats:", error.message)
      return []
    }

    for (const embed of data ?? []) {
      const stats = statsByOwner.get(embed.owner_id) ?? {
        views: 0,
        upvotes: 0,
      }
      stats.views += embed.views_count
      stats.upvotes += embed.upvotes_count
      statsByOwner.set(embed.owner_id, stats)
    }

    if (!data || data.length < pageSize) break
  }

  const ownerIds = [...statsByOwner.keys()]
  const profiles = (
    await Promise.all(
      Array.from({ length: Math.ceil(ownerIds.length / 100) }, (_, index) =>
        supabase.rpc("get_public_profiles", {
          p_profile_ids: ownerIds.slice(index * 100, (index + 1) * 100),
        })
      )
    )
  ).flatMap(({ data, error }) => {
    if (error) {
      console.error("Failed to load creator profiles:", error.message)
      return []
    }
    return data ?? []
  })

  return profiles
    .flatMap((profile) => {
      const stats = statsByOwner.get(profile.id)
      if (!stats) return []
      return [{ profile, stats }]
    })
    .sort(
      (a, b) =>
        b.stats.upvotes - a.stats.upvotes || b.stats.views - a.stats.views
    )
}

export default async function TopCreatorsPage() {
  const creators = await getTopCreators()

  return (
    <main className="site-container py-10">
      <h1 className="text-2xl font-semibold">Top creators</h1>

      {creators.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No creators yet.</p>
      ) : (
        <ol className="mt-6 divide-y rounded-md border">
          {creators.map(({ profile, stats }, index) => (
            <li
              key={profile.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-5"
            >
              <span className="w-8 shrink-0 text-sm text-muted-foreground tabular-nums">
                #{index + 1}
              </span>
              <Link
                href={`/user/${encodeURIComponent(profile.slug)}`}
                className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserRound className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {profile.display_name || profile.slug}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{profile.slug}
                  </span>
                </span>
              </Link>
              <div className="ml-auto flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
                <span
                  className="inline-flex items-center gap-1.5"
                  aria-label={`${stats.upvotes.toLocaleString("en-US")} upvotes`}
                  title="Total upvotes"
                >
                  <ArrowUp className="size-4" />
                  {stats.upvotes.toLocaleString("en-US")}
                </span>
                <span
                  className="inline-flex items-center gap-1.5"
                  aria-label={`${stats.views.toLocaleString("en-US")} views`}
                  title="Total views"
                >
                  <Eye className="size-4" />
                  {stats.views.toLocaleString("en-US")}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
