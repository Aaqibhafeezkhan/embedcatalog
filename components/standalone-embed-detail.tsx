"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Eye,
  LoaderCircle,
  UserRound,
} from "lucide-react"

import { useAuth } from "components/auth-provider"
import { EmbedBookmark } from "components/embed-bookmark"
import { Button } from "components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card"
import {
  type EmbedTheme,
  getCustomEmbedSize,
  getLinkedEmbedPagePath,
  getPublicLinkedEmbedSrc,
  getPublicStandaloneEmbedSrc,
} from "lib/embed"
import { siteConfig } from "lib/site"
import { supabase } from "lib/supabase/client"
import { cn } from "lib/utils"

type StandaloneEmbed = {
  id: string
  slug: string
  title: string
  description: string
  viewsCount: number
  upvotesCount: number
  createdAt: string
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be unavailable in insecure contexts.
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1.5">
        <code className="block min-w-0 flex-1 overflow-x-auto text-xs whitespace-nowrap text-muted-foreground">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  )
}

function StandaloneEmbedDetail({
  profileSlug,
  author,
  project,
  embed,
}: {
  profileSlug?: string
  author?: { displayName: string; avatarUrl: string | null }
  project?: { slug: string; name: string }
  embed: StandaloneEmbed
}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [theme, setTheme] = React.useState<EmbedTheme>("light")
  const [views, setViews] = React.useState(embed.viewsCount)
  const [upvotes, setUpvotes] = React.useState(embed.upvotesCount)
  const [hasUpvoted, setHasUpvoted] = React.useState(false)
  const [resolvedUserId, setResolvedUserId] = React.useState<string | null>(
    null
  )
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestInProgress = React.useRef(false)

  const { width, height } = getCustomEmbedSize()
  const embedSrc = project
    ? getPublicLinkedEmbedSrc(siteConfig.url, project.slug, embed.slug, theme)
    : getPublicStandaloneEmbedSrc(
        siteConfig.url,
        profileSlug ?? "",
        embed.slug,
        theme
      )
  const pageUrl = project
    ? `${siteConfig.url}${getLinkedEmbedPagePath(project.slug, embed.slug)}`
    : `${siteConfig.url}/user/${encodeURIComponent(profileSlug ?? "")}/embed/${encodeURIComponent(embed.slug)}`
  const html = `<a href="${pageUrl}" target="_blank" rel="noreferrer noopener"><img src="${embedSrc}" alt="${embed.title}" style="width: ${width}px; height: ${height}px;" /></a>`

  // Count one view per browser session.
  React.useEffect(() => {
    const key = `embed-view:${embed.id}`
    const hostname = window.location.hostname
    if (hostname === "localhost" || hostname === "127.0.0.1") return

    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, "1")
    } catch {
      // Storage unavailable; fall through and count the view.
    }

    supabase
      .rpc("record_standalone_embed_view", { p_embed_id: embed.id })
      .then(({ error: rpcError }) => {
        if (!rpcError) setViews((count) => count + 1)
      })
  }, [embed.id])

  React.useEffect(() => {
    if (!user) return

    let cancelled = false
    supabase
      .from("standalone_embed_upvotes")
      .select("embed_id")
      .eq("embed_id", embed.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setHasUpvoted(Boolean(data))
        setResolvedUserId(user.id)
      })

    return () => {
      cancelled = true
    }
  }, [embed.id, user])

  async function toggleUpvote() {
    if (!user) {
      router.push("/login")
      return
    }
    if (requestInProgress.current || resolvedUserId !== user.id) return

    requestInProgress.current = true
    setSaving(true)
    setError(null)

    const next = !hasUpvoted
    const result = next
      ? await supabase
          .from("standalone_embed_upvotes")
          .insert({ embed_id: embed.id, user_id: user.id })
      : await supabase
          .from("standalone_embed_upvotes")
          .delete()
          .eq("embed_id", embed.id)
          .eq("user_id", user.id)

    if (result.error) {
      setError("Could not update your upvote. Please try again.")
    } else {
      setHasUpvoted(next)
      setUpvotes((count) => count + (next ? 1 : -1))
    }

    setSaving(false)
    requestInProgress.current = false
  }

  const checkingVote = Boolean(user) && resolvedUserId !== user?.id

  return (
    <main className="site-container py-8 sm:py-12">
      <Button variant="ghost" size="sm" asChild>
        {project ? (
          <Link href={`/projects/${encodeURIComponent(project.slug)}`}>
            <ArrowLeft className="size-4" />
            {project.name}
          </Link>
        ) : (
          <Link href={`/user/${encodeURIComponent(profileSlug ?? "")}`}>
            <ArrowLeft className="size-4" />@{profileSlug}
          </Link>
        )}
      </Button>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{embed.title}</h1>
          {project ? (
            <Link
              href={`/projects/${encodeURIComponent(project.slug)}`}
              className="mt-2 block w-fit text-sm font-medium hover:underline"
            >
              {project.name}
            </Link>
          ) : null}
          {profileSlug ? (
            <Link
              href={`/user/${encodeURIComponent(profileSlug ?? "")}`}
              className="mt-2 flex w-fit items-center gap-2 text-sm hover:underline"
            >
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                {author?.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="font-medium">
                {author?.displayName ?? profileSlug}
              </span>
              <span className="text-muted-foreground">@{profileSlug}</span>
            </Link>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Created{" "}
            <time dateTime={embed.createdAt}>
              {new Date(embed.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>
          </p>
          {embed.description ? (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {embed.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Eye className="size-4" />
              {views.toLocaleString("en-US")} views
            </span>
            <Button
              type="button"
              variant={hasUpvoted ? "secondary" : "default"}
              size="sm"
              onClick={() => void toggleUpvote()}
              disabled={authLoading || checkingVote || saving}
              aria-pressed={hasUpvoted}
              title={user ? undefined : "Sign in to upvote"}
              className="h-9 gap-1.5 px-3 shadow-sm"
            >
              {saving || checkingVote ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
              <span>{hasUpvoted ? "Upvoted" : "Upvote"}</span>
              <span className="rounded-sm bg-background/15 px-1.5 py-0.5 text-xs tabular-nums">
                {upvotes.toLocaleString("en-US")}
              </span>
            </Button>
            <EmbedBookmark embedId={embed.id} />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </header>

      <Card className="mt-8 max-w-3xl gap-4 py-4 shadow-none">
        <CardHeader className="flex-row items-center justify-between border-b px-4 pb-4">
          <CardTitle className="text-sm font-medium">Preview</CardTitle>
          <div className="flex items-center gap-2">
            {(["light", "dark"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                aria-pressed={theme === item}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1 text-xs capitalize transition-colors",
                  theme === item
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4">
          <Image
            key={embedSrc}
            src={embedSrc}
            alt={embed.title}
            width={width}
            height={height}
            unoptimized
          />
          <CopyField label="Share link" value={pageUrl} />
          <CopyField label="HTML" value={html} />
          <CopyField label="Image URL" value={embedSrc} />
        </CardContent>
      </Card>
    </main>
  )
}

export { StandaloneEmbedDetail }
