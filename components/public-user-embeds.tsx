"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Images, Loader2, UserRound } from "lucide-react"

import { ProjectInfoMarkdown } from "components/project-info-markdown"
import { Button } from "components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card"
import type { Database } from "lib/supabase/database"
import { getPublicStandaloneEmbedSrc } from "lib/embed"
import { siteConfig } from "lib/site"
import type { StandaloneEmbedTheme } from "lib/standalone-embed-image"
import { supabase } from "lib/supabase/client"

type PublicEmbed = Pick<
  Database["public"]["Tables"]["standalone_embeds"]["Row"],
  "id" | "slug" | "title" | "description" | "created_at"
>

type PublicProfile =
  Database["public"]["Functions"]["get_public_profiles"]["Returns"][number]

function getSafeSocialUrl(value: string | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null
  } catch {
    return null
  }
}

function PublicEmbedCard({
  profileSlug,
  embed,
}: {
  profileSlug: string
  embed: PublicEmbed
}) {
  const [theme, setTheme] = React.useState<StandaloneEmbedTheme>("light")
  const src = getPublicStandaloneEmbedSrc(
    siteConfig.url,
    profileSlug,
    embed.slug,
    theme
  )

  return (
    <Card className="gap-4 py-4 shadow-none">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium">
          <Link
            href={`/user/${encodeURIComponent(profileSlug)}/embed/${encodeURIComponent(embed.slug)}`}
            className="hover:underline"
          >
            {embed.title}
          </Link>
        </CardTitle>
        {embed.description && (
          <CardDescription>{embed.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Embed theme"
        >
          <Button
            type="button"
            size="sm"
            variant={theme === "light" ? "secondary" : "ghost"}
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
          >
            Light
          </Button>
          <Button
            type="button"
            size="sm"
            variant={theme === "dark" ? "secondary" : "ghost"}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
          >
            Dark
          </Button>
        </div>
        <Image
          src={src}
          alt={embed.title}
          width={320}
          height={84}
          unoptimized
        />
      </CardContent>
    </Card>
  )
}

function PublicUserEmbeds({ login }: { login: string }) {
  const [profile, setProfile] = React.useState<PublicProfile | null>(null)
  const [bio, setBio] = React.useState("")
  const [embeds, setEmbeds] = React.useState<PublicEmbed[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const { data: profiles, error: profileError } = await supabase.rpc(
        "get_public_profiles",
        { p_profile_slug: login }
      )
      const profile = profiles?.[0]

      if (cancelled) return
      if (profileError || !profile) {
        setError("This profile could not be found.")
        setLoading(false)
        return
      }
      setProfile(profile)

      const { data: bioData } = await supabase.rpc("get_public_profile_bio", {
        p_profile_id: profile.id,
      })
      if (cancelled) return
      setBio(bioData ?? "")

      const { data, error: embedsError } = await supabase
        .from("standalone_embeds")
        .select("id, slug, title, description, created_at")
        .eq("owner_id", profile.id)
        .eq("status", "approved")
        .is("project_id", null)
        .order("created_at", { ascending: false })

      if (cancelled) return
      if (embedsError) {
        setError("Could not load this profile's embeds.")
      } else {
        setEmbeds(data ?? [])
      }
      setLoading(false)
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [login])

  return (
    <main className="site-container py-8 sm:py-12">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="size-4" />
          Projects
        </Link>
      </Button>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : (
        <>
          <header className="mt-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">
                  {profile?.display_name || login}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  @{login}
                </p>
              </div>
            </div>
            <nav
              aria-label="Social networks"
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
            >
              {[
                ["GitHub", profile?.socials?.github],
                ["Twitter", profile?.socials?.twitter],
                ["YouTube", profile?.socials?.youtube],
              ].map(([label, value]) => {
                const href = getSafeSocialUrl(value)
                return href ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {label}
                  </a>
                ) : null
              })}
            </nav>
          </header>

          <ProjectInfoMarkdown content={bio} className="mt-5" />

          <nav
            role="tablist"
            aria-label="Profile sections"
            className="mt-5 flex border-b"
          >
            <button
              id="profile-embeds-tab"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="profile-embeds-panel"
              className="flex items-center gap-2 border-b-2 border-foreground px-1 pb-3 text-sm font-medium"
            >
              Embeds
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {embeds.length}
              </span>
            </button>
          </nav>

          {embeds.length === 0 ? (
            <Card
              id="profile-embeds-panel"
              role="tabpanel"
              aria-labelledby="profile-embeds-tab"
              className="mt-6 max-w-xl"
            >
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Images className="size-8 text-muted-foreground" />
                <p className="font-medium">No public embeds yet</p>
                <p className="text-sm text-muted-foreground">
                  Published custom embeds will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <section
              id="profile-embeds-panel"
              role="tabpanel"
              aria-labelledby="profile-embeds-tab"
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {embeds.map((embed) => (
                <PublicEmbedCard
                  key={embed.id}
                  profileSlug={login}
                  embed={embed}
                />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

export { PublicUserEmbeds }
