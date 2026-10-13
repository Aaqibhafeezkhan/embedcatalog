"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2 } from "lucide-react"

import { useAuth } from "components/auth-provider"
import { useNotification } from "components/notification-provider"
import { Button } from "components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card"
import { ProjectEmbedEditor } from "components/project-embed-editor"
import type { CreateProjectEmbed } from "app/account/create-project/draft-context"
import { supabase } from "lib/supabase/client"
import { bindGithubRepo } from "lib/embed-variables"
import { isValidEmbedSlug, slugifyEmbed } from "lib/standalone-embed-slug"

const freeEmbedLimit = 3
const premiumEmbedLimit = 15

function CreateEmbedPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { notify } = useNotification()
  const [profileSlug, setProfileSlug] = React.useState<string | null>(null)
  const [embeds, setEmbeds] = React.useState<CreateProjectEmbed[]>([])
  const [existingEmbedCount, setExistingEmbedCount] = React.useState(0)
  const [isPremium, setIsPremium] = React.useState(false)
  const [fetchingProfile, setFetchingProfile] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const embedLimit = isPremium ? premiumEmbedLimit : freeEmbedLimit
  const remainingEmbeds = Math.max(0, embedLimit - existingEmbedCount)

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, router, user])

  React.useEffect(() => {
    if (!user) return

    let cancelled = false

    async function loadProfile() {
      const [profileResult, projectsResult, embedsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("slug")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("projects").select("is_premium").eq("owner_id", user!.id),
        supabase
          .from("standalone_embeds")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user!.id),
      ])

      if (cancelled) return
      if (
        profileResult.error ||
        !profileResult.data ||
        projectsResult.error ||
        embedsResult.error
      ) {
        setError(
          profileResult.error?.message ??
            projectsResult.error?.message ??
            embedsResult.error?.message ??
            "Could not load your account."
        )
      } else {
        const premium = projectsResult.data.some(
          (project) => project.is_premium
        )
        const count = embedsResult.count ?? 0
        setProfileSlug(profileResult.data.slug)
        setIsPremium(premium)
        setExistingEmbedCount(count)
      }
      setFetchingProfile(false)
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !user || fetchingProfile) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function submitEmbeds() {
    if (!user || !profileSlug) return
    if (embeds.length === 0) {
      setError("Add at least one embed.")
      return
    }
    if (embeds.some((embed) => !embed.name?.trim())) {
      setError("Enter a name for each embed.")
      return
    }
    const slugs = embeds.map((embed) =>
      slugifyEmbed(embed.slug?.trim() || embed.name || "")
    )
    if (slugs.some((slug) => !isValidEmbedSlug(slug))) {
      setError("Use lowercase letters, numbers, and hyphens for embed URLs.")
      return
    }
    if (new Set(slugs).size !== slugs.length) {
      setError("Each embed must have a different embed URL.")
      return
    }

    setSaving(true)
    const [projectsResult, embedsResult] = await Promise.all([
      supabase.from("projects").select("is_premium").eq("owner_id", user.id),
      supabase
        .from("standalone_embeds")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
    ])

    if (projectsResult.error || embedsResult.error) {
      setError(
        projectsResult.error?.message ??
          embedsResult.error?.message ??
          "Could not verify your embed limit."
      )
      setSaving(false)
      return
    }

    const premium = projectsResult.data.some((project) => project.is_premium)
    const limit = premium ? premiumEmbedLimit : freeEmbedLimit
    const count = embedsResult.count ?? 0
    setIsPremium(premium)
    setExistingEmbedCount(count)
    if (count + embeds.length > limit) {
      setError(
        `You can create up to ${limit} custom embeds. You already have ${count}.`
      )
      setSaving(false)
      return
    }

    setError(null)
    setNotice(null)

    const rows = embeds.map((embed) => ({
      owner_id: user.id,
      slug: slugifyEmbed(embed.slug?.trim() || embed.name || ""),
      title: embed.name!.trim(),
      image_title: bindGithubRepo(embed.title.trim(), embed.githubRepo),
      image_description: bindGithubRepo(
        embed.description.trim(),
        embed.githubRepo
      ),
      status: "approved" as const,
    }))

    const { data, error: insertError } = await supabase
      .from("standalone_embeds")
      .insert(rows)
      .select(
        "id, owner_id, slug, title, description, project_id, status, views_count, upvotes_count, created_at"
      )

    setSaving(false)
    if (insertError?.code === "P0001") {
      notify(insertError.message)
      return
    }
    if (insertError || !data) {
      setError(
        insertError?.code === "23505"
          ? "An embed with this embed URL already exists in your account."
          : (insertError?.message ?? "Could not create the embeds.")
      )
      return
    }

    setExistingEmbedCount(count + data.length)
    setEmbeds([])
    setNotice(
      `${data.length} embed${data.length === 1 ? "" : "s"} created and published.`
    )
  }

  return (
    <main className="site-container py-8 sm:py-12">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account">
            <ChevronLeft className="size-4" />
            Account
          </Link>
        </Button>
        <h1 className="mt-4 text-2xl font-semibold">Create embed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create up to {embedLimit} custom embeds ({existingEmbedCount} used).
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Premium increases the limit from 3 to 15 custom embeds.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ProjectEmbedEditor
          embeds={embeds}
          onEmbedsChange={setEmbeds}
          defaultEmbedName={`embed-${existingEmbedCount + embeds.length + 1}`}
          maxEmbeds={remainingEmbeds}
          showSlug
          addInDialog
        />

        <aside className="lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Save embeds</CardTitle>
              <CardDescription>
                Your embeds are published immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-sm text-muted-foreground" role="status">
                  {notice}
                </p>
              )}
              <Button
                type="button"
                onClick={() => void submitEmbeds()}
                disabled={saving || embeds.length === 0 || !profileSlug}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Creating" : "Create embeds"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/submit">Go to submit page</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/account/embeds">My embeds</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

export default CreateEmbedPage
