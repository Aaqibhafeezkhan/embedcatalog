"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronLeft,
  Copy,
  Ellipsis,
  Images,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react"

import { useAuth } from "components/auth-provider"
import { useNotification } from "components/notification-provider"
import { StandaloneEmbedEditDialog } from "components/standalone-embed-edit-dialog"
import { Button } from "components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card"
import type { Database } from "lib/supabase/database"
import { getPublicStandaloneEmbedSrc } from "lib/embed"
import { siteConfig } from "lib/site"
import {
  imageHeight,
  imageWidth,
  type StandaloneEmbedTheme,
} from "lib/standalone-embed-image"
import { supabase } from "lib/supabase/client"

type StandaloneEmbed = Database["public"]["Tables"]["standalone_embeds"]["Row"]
type ProjectEmbed = Database["public"]["Tables"]["project_embeds"]["Row"]
type OwnedProject = {
  id: string
  name: string
  slug: string
  url: string
  status: string
}
type ProjectEmbedWithProject = ProjectEmbed & { project: OwnedProject }
type PendingProjectRequest = {
  embed_id: string
  project_id: string | null
}

function StandaloneEmbedCard({
  embed,
  profileSlug,
  projects,
  linkedProject,
  pendingProjectRequest,
  linking,
  deleting,
  onProjectChange,
  onDelete,
  onEmbedUpdated,
}: {
  embed: StandaloneEmbed
  profileSlug: string | null
  projects: OwnedProject[]
  linkedProject?: OwnedProject
  pendingProjectRequest?: PendingProjectRequest
  linking: boolean
  deleting: boolean
  onProjectChange: (projectId: string | null) => void
  onDelete: () => void
  onEmbedUpdated: (embed: StandaloneEmbed) => void
}) {
  const [theme, setTheme] = React.useState<StandaloneEmbedTheme>("light")
  const [copied, setCopied] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editWindowExpired, setEditWindowExpired] = React.useState(false)
  const { notify } = useNotification()
  const editExpiresAt = new Date(embed.created_at).getTime() + 86400000
  const editingAllowed = !editWindowExpired && embed.edit_count < 20
  const imageSrc = profileSlug
    ? getPublicStandaloneEmbedSrc(
        siteConfig.url,
        profileSlug,
        embed.slug,
        theme
      )
    : ""
  const pageUrl = profileSlug
    ? `${siteConfig.url}/user/${encodeURIComponent(profileSlug)}/embed/${encodeURIComponent(embed.slug)}`
    : ""
  const code = `<a href="${pageUrl}" target="_blank" rel="noreferrer noopener"><img src="${imageSrc}" alt="${embed.title}" width="${imageWidth}" height="${imageHeight}" /></a>`

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => setEditWindowExpired(true),
      Math.max(0, editExpiresAt - Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [editExpiresAt])

  function requestEdit() {
    if (Date.now() >= editExpiresAt) {
      setEditWindowExpired(true)
      notify("This embed can no longer be edited after the first 24 hours.")
      return
    }
    if (embed.edit_count >= 20) {
      notify("This embed has reached its 20-edit limit.")
      return
    }
    setEditDialogOpen(true)
  }

  return (
    <Card className="gap-4 py-4 shadow-none">
      <CardHeader className="border-b px-4 pb-4">
        <CardTitle className="text-sm font-medium">{embed.title}</CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{embed.slug}.png</span>
          {pendingProjectRequest ? (
            <span>Application pending</span>
          ) : linkedProject ? (
            <span>Linked to {linkedProject.name}</span>
          ) : (
            <span className="capitalize">{embed.status}</span>
          )}
        </div>
        <CardAction>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${embed.title}`}
                title="Embed actions"
                disabled={linking || deleting}
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">
                  {pendingProjectRequest
                    ? "Application pending review"
                    : linkedProject
                      ? `Linked to ${linkedProject.name}`
                      : "Link to project"}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={() => onProjectChange(null)}
                  disabled={linking || Boolean(pendingProjectRequest)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                >
                  {linkedProject ? "Request unlink" : "Not linked"}
                  {!linkedProject && <Check className="size-4" />}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                {projects.map((project) => (
                  <DropdownMenu.Item
                    key={project.id}
                    onSelect={() => onProjectChange(project.id)}
                    disabled={
                      linking ||
                      Boolean(pendingProjectRequest) ||
                      linkedProject?.id === project.id
                    }
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                  >
                    <span className="min-w-0 truncate">{project.name}</span>
                    {linkedProject?.id === project.id && (
                      <Check className="size-4 shrink-0" />
                    )}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={requestEdit}
                  aria-disabled={!editingAllowed}
                  title={
                    editingAllowed
                      ? "Edit embed"
                      : "This embed can no longer be edited"
                  }
                  className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent ${editingAllowed ? "" : "text-muted-foreground opacity-50"}`}
                >
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={onDelete}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent focus:bg-accent"
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        {embed.status === "approved" && profileSlug ? (
          <>
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
                onClick={() => {
                  setTheme("light")
                }}
              >
                Light
              </Button>
              <Button
                type="button"
                size="sm"
                variant={theme === "dark" ? "secondary" : "ghost"}
                aria-pressed={theme === "dark"}
                onClick={() => {
                  setTheme("dark")
                }}
              >
                Dark
              </Button>
            </div>
            <Image
              src={imageSrc}
              alt={embed.title}
              width={imageWidth}
              height={imageHeight}
              unoptimized
            />
            <code className="block overflow-x-auto rounded-md border bg-muted p-2 text-xs whitespace-nowrap text-muted-foreground">
              {code}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyCode()}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy embed code"}
            </Button>
            {pendingProjectRequest && (
              <p className="text-xs text-muted-foreground" role="status">
                {pendingProjectRequest.project_id
                  ? `Waiting for approval to link to ${projects.find((project) => project.id === pendingProjectRequest.project_id)?.name ?? "project"}.`
                  : "Waiting for approval to unlink from the project."}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-md border bg-muted/40 p-4">
            <p className="text-sm font-medium capitalize">
              {embed.status === "pending"
                ? "Pending review"
                : embed.status === "draft"
                  ? "Draft"
                  : "Rejected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {embed.description || "No description provided."}
            </p>
          </div>
        )}
      </CardContent>
      <StandaloneEmbedEditDialog
        embed={embed}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={onEmbedUpdated}
      />
    </Card>
  )
}

function AccountEmbedsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [profileSlug, setProfileSlug] = React.useState<string | null>(null)
  const [projects, setProjects] = React.useState<OwnedProject[]>([])
  const [projectEmbeds, setProjectEmbeds] = React.useState<
    ProjectEmbedWithProject[]
  >([])
  const [standaloneEmbeds, setStandaloneEmbeds] = React.useState<
    StandaloneEmbed[]
  >([])
  const [pendingProjectRequests, setPendingProjectRequests] = React.useState<
    PendingProjectRequest[]
  >([])
  const [fetching, setFetching] = React.useState(true)
  const [linkingId, setLinkingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, router, user])

  React.useEffect(() => {
    if (!user) return

    let cancelled = false

    async function loadEmbeds() {
      const [profileResult, projectsResult, standaloneResult, requestsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("slug")
            .eq("id", user!.id)
            .maybeSingle(),
          supabase
            .from("projects")
            .select("id, name, slug, url, status")
            .eq("owner_id", user!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("standalone_embeds")
            .select(
              "id, owner_id, slug, title, description, image_title, image_description, project_id, status, views_count, upvotes_count, edit_count, created_at"
            )
            .eq("owner_id", user!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("standalone_embed_project_requests")
            .select("embed_id, project_id")
            .eq("owner_id", user!.id)
            .eq("status", "pending"),
        ])

      if (cancelled) return
      if (
        profileResult.error ||
        projectsResult.error ||
        standaloneResult.error ||
        requestsResult.error
      ) {
        setError(
          profileResult.error?.message ??
            projectsResult.error?.message ??
            standaloneResult.error?.message ??
            requestsResult.error?.message ??
            "Could not load your embeds."
        )
        setFetching(false)
        return
      }

      const ownedProjects = projectsResult.data ?? []
      const projectIds = ownedProjects.map((project) => project.id)
      let loadedProjectEmbeds: ProjectEmbedWithProject[] = []

      if (projectIds.length > 0) {
        const { data, error: projectEmbedsError } = await supabase
          .from("project_embeds")
          .select(
            "id, project_id, short_id, title, description, position, created_at, updated_at"
          )
          .in("project_id", projectIds)
          .order("position", { ascending: true })

        if (cancelled) return
        if (projectEmbedsError) {
          setError(projectEmbedsError.message)
          setFetching(false)
          return
        }

        const projectsById = new Map(
          ownedProjects.map((project) => [project.id, project])
        )
        loadedProjectEmbeds = (data ?? []).flatMap((embed) => {
          const project = projectsById.get(embed.project_id)
          return project ? [{ ...embed, project }] : []
        })
      }

      setProfileSlug(profileResult.data?.slug ?? null)
      setProjects(ownedProjects)
      setProjectEmbeds(loadedProjectEmbeds)
      setStandaloneEmbeds(standaloneResult.data ?? [])
      setPendingProjectRequests(requestsResult.data ?? [])
      setFetching(false)
    }

    void loadEmbeds()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !user || fetching) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function setEmbedProject(
    embed: StandaloneEmbed,
    projectId: string | null
  ) {
    if (embed.project_id === projectId) return
    if (
      pendingProjectRequests.some((request) => request.embed_id === embed.id)
    ) {
      setError("This embed already has an application waiting for review.")
      return
    }

    setLinkingId(embed.id)
    setError(null)
    setNotice(null)

    const { data, error: updateError } = await supabase
      .from("standalone_embed_project_requests")
      .insert({
        embed_id: embed.id,
        owner_id: user!.id,
        project_id: projectId,
      })
      .select("embed_id, project_id")
      .single()

    if (updateError) {
      setError(updateError.message)
      setLinkingId(null)
      return
    }

    setPendingProjectRequests((current) => [...current, data])
    setNotice("Project application sent for review.")
    setLinkingId(null)
  }

  function updateStandaloneEmbed(updatedEmbed: StandaloneEmbed) {
    setStandaloneEmbeds((current) =>
      current.map((embed) =>
        embed.id === updatedEmbed.id ? updatedEmbed : embed
      )
    )
    setNotice("Embed updated.")
  }

  async function deleteEmbed(embed: StandaloneEmbed) {
    if (!user) return
    if (
      !window.confirm("Delete this embed submission? This can't be undone.")
    ) {
      return
    }
    setDeletingId(embed.id)
    setError(null)

    const { error: deleteError } = await supabase
      .from("standalone_embeds")
      .delete()
      .eq("id", embed.id)
      .eq("owner_id", user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setStandaloneEmbeds((current) =>
        current.filter((item) => item.id !== embed.id)
      )
      setNotice("Embed deleted.")
    }
    setDeletingId(null)
  }

  const projectsById = new Map(projects.map((project) => [project.id, project]))

  return (
    <main className="site-container py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account">
              <ChevronLeft className="size-4" />
              Account
            </Link>
          </Button>
          <h1 className="mt-4 text-2xl font-semibold">My embeds</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Project embeds and your custom image embeds.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/account/create-embed">Create embed</Link>
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <p
          className={`mb-6 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? notice}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Project embeds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Embeds configured on your projects.
          </p>
        </div>
        {projectEmbeds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Images className="size-7 text-muted-foreground" />
              <p className="font-medium">No project embeds yet</p>
              <Button variant="link" asChild>
                <Link href="/account/create-project">Create a project</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projectEmbeds.map((embed) => (
              <Card key={embed.id} className="gap-3 py-4 shadow-none">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm font-medium">
                    {embed.title}
                  </CardTitle>
                  <CardDescription>
                    {embed.project.name} · {embed.project.status}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 px-4">
                  <p className="text-sm text-muted-foreground">
                    {embed.description || "No description provided."}
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/account/edit-embeds?id=${embed.project.id}`}>
                      Edit project embeds
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Custom embeds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Published embeds can be applied to your projects for moderation.
          </p>
        </div>
        {standaloneEmbeds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Images className="size-7 text-muted-foreground" />
              <p className="font-medium">No custom embeds yet</p>
              <Button variant="link" asChild>
                <Link href="/account/create-embed">Create an embed</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          standaloneEmbeds.map((embed) => (
            <StandaloneEmbedCard
              key={embed.id}
              embed={embed}
              profileSlug={profileSlug}
              projects={projects}
              pendingProjectRequest={pendingProjectRequests.find(
                (request) => request.embed_id === embed.id
              )}
              linkedProject={
                embed.project_id
                  ? projectsById.get(embed.project_id)
                  : undefined
              }
              linking={linkingId === embed.id}
              deleting={deletingId === embed.id}
              onProjectChange={(projectId) =>
                void setEmbedProject(embed, projectId)
              }
              onDelete={() => void deleteEmbed(embed)}
              onEmbedUpdated={updateStandaloneEmbed}
            />
          ))
        )}
      </section>
    </main>
  )
}

export default AccountEmbedsPage
