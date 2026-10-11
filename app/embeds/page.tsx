"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Loader2, Search, X } from "lucide-react"

import { CustomEmbedCard } from "components/project-embeds"
import { Card, CardContent } from "components/ui/card"
import { Input } from "components/ui/input"
import { siteConfig } from "lib/site"
import { supabase } from "lib/supabase/client"

type PublicEmbed = {
  key: string
  source: "project" | "user"
  title: string
  projectUrl: string
  shortId?: string
  projectName?: string
  projectSlug?: string
  profileSlug?: string
  standaloneSlug?: string
  avatarUrl?: string | null
}

function EmbedsPageContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [embeds, setEmbeds] = React.useState<PublicEmbed[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "")

  // Keep the URL shareable without triggering a Next.js navigation.
  React.useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)

    const queryString = params.toString()
    if (queryString === window.location.search.slice(1)) {
      return
    }

    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname
    )
  }, [query, pathname])

  React.useEffect(() => {
    let cancelled = false

    async function loadEmbeds() {
      const [projectsResult, userEmbedsResult] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, slug, url")
          .eq("status", "published"),
        supabase
          .from("standalone_embeds")
          .select("id, owner_id, slug, title")
          .eq("status", "approved"),
      ])

      if (cancelled) return
      if (projectsResult.error || userEmbedsResult.error) {
        setEmbeds([])
        setLoading(false)
        return
      }

      const projects = projectsResult.data ?? []
      const userEmbeds = userEmbedsResult.data ?? []
      const projectIds = projects.map((project) => project.id)
      const ownerIds = [...new Set(userEmbeds.map((embed) => embed.owner_id))]

      const [projectEmbedsResult, profilesResult] = await Promise.all([
        projectIds.length
          ? supabase
              .from("project_embeds")
              .select("id, project_id, short_id, title, position")
              .in("project_id", projectIds)
              .order("position", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        ownerIds.length
          ? supabase.rpc("get_public_profiles", {
              p_profile_ids: ownerIds,
            })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (cancelled) return
      if (projectEmbedsResult.error || profilesResult.error) {
        setEmbeds([])
        setLoading(false)
        return
      }

      const projectsById = new Map(
        projects.map((project) => [project.id, project])
      )
      const profilesById = new Map(
        profilesResult.data.map((profile) => [profile.id, profile])
      )
      const projectEmbeds = projectEmbedsResult.data.flatMap((embed) => {
        const project = projectsById.get(embed.project_id)
        if (!project) return []

        return [
          {
            key: `project-${embed.id}`,
            source: "project" as const,
            shortId: embed.short_id,
            title: embed.title,
            projectName: project.name,
            projectSlug: project.slug,
            projectUrl: project.url,
          },
        ]
      })
      const standaloneEmbeds = userEmbeds.flatMap((embed) => {
        const profile = profilesById.get(embed.owner_id)
        if (!profile) return []

        const profileUrl = `${siteConfig.url}/user/${encodeURIComponent(profile.slug)}`
        return [
          {
            key: `user-${embed.id}`,
            source: "user" as const,
            title: embed.title,
            projectUrl: profileUrl,
            profileSlug: profile.slug,
            avatarUrl: profile.avatar_url,
            standaloneSlug: embed.slug,
          },
        ]
      })

      setEmbeds([...projectEmbeds, ...standaloneEmbeds])
      setLoading(false)
    }

    void loadEmbeds()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredEmbeds = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return embeds

    return embeds.filter(
      (embed) =>
        embed.title.toLowerCase().includes(q) ||
        embed.projectName?.toLowerCase().includes(q) ||
        embed.profileSlug?.toLowerCase().includes(q)
    )
  }, [embeds, query])

  return (
    <main className="site-container py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Embeds{" "}
          {!loading && (
            <span className="font-normal text-muted-foreground">
              ({filteredEmbeds.length})
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Custom embeds from projects and users in EmbedCatalog.
        </p>
      </div>

      <div className="mb-6 flex min-w-0 items-center gap-2">
        <div className="relative max-w-sm min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or project name..."
            className="pl-9"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : embeds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No custom embeds yet.
          </CardContent>
        </Card>
      ) : filteredEmbeds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <p>No custom embeds match your search.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-primary underline underline-offset-4 hover:opacity-80"
            >
              Clear search
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredEmbeds.map((embed) => (
            <div key={embed.key}>
              <CustomEmbedCard
                slug={
                  embed.source === "user"
                    ? embed.profileSlug!
                    : embed.projectSlug!
                }
                shortId={embed.shortId}
                standaloneProfileSlug={
                  embed.source === "user" ? embed.profileSlug : undefined
                }
                standaloneSlug={
                  embed.source === "user" ? embed.standaloneSlug : undefined
                }
                projectUrl={embed.projectUrl}
                title={embed.title}
                projectName={embed.projectName}
                projectHref={
                  embed.projectSlug
                    ? `/projects/${embed.projectSlug}`
                    : undefined
                }
                creator={
                  embed.profileSlug
                    ? {
                        slug: embed.profileSlug,
                        avatarUrl: embed.avatarUrl ?? null,
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function EmbedsPage() {
  return (
    <React.Suspense
      fallback={
        <main className="site-container py-10">
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </main>
      }
    >
      <EmbedsPageContent />
    </React.Suspense>
  )
}

export default EmbedsPage
