"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Mail, Plus } from "lucide-react"

import { useAuth } from "components/auth-provider"
import { Button } from "components/ui/button"
import { Textarea } from "components/ui/textarea"
import { supabase } from "lib/supabase/client"

type ProjectStatus = "draft" | "pending" | "published" | "rejected"
type Project = {
  id: string
  name: string
  status: ProjectStatus
  is_premium: boolean
  submission_comment: string | null
}

type SubmitEmbed = {
  id: string
  title: string
  status: "draft" | "pending" | "approved" | "rejected"
}

const embedStatusLabel: Record<SubmitEmbed["status"], string> = {
  draft: "Draft",
  pending: "Awaiting review",
  approved: "Published",
  rejected: "Rejected",
}

const statusLabel: Record<ProjectStatus, string> = {
  draft: "Draft",
  pending: "Awaiting review",
  published: "Published",
  rejected: "Rejected",
}

function SubmitProjectPanel() {
  const { user, loading } = useAuth()
  const [projects, setProjects] = React.useState<Project[]>([])
  const [projectsLoadedFor, setProjectsLoadedFor] = React.useState<
    string | null
  >(null)
  const [projectsError, setProjectsError] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [comments, setComments] = React.useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const projectsLoading = Boolean(user && projectsLoadedFor !== user.id)

  const [embeds, setEmbeds] = React.useState<SubmitEmbed[]>([])
  const [embedsLoadedFor, setEmbedsLoadedFor] = React.useState<string | null>(
    null
  )
  const [embedsError, setEmbedsError] = React.useState<string | null>(null)
  const [submittingEmbedId, setSubmittingEmbedId] = React.useState<
    string | null
  >(null)
  const embedsLoading = Boolean(user && embedsLoadedFor !== user.id)

  React.useEffect(() => {
    if (!user) return

    let cancelled = false

    supabase
      .from("standalone_embeds")
      .select("id, title, status")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setEmbedsError(error.message)
        } else {
          setEmbedsError(null)
          setEmbeds(data)
        }
        setEmbedsLoadedFor(user.id)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  async function submitEmbedForReview(embedId: string) {
    setSubmittingEmbedId(embedId)
    setEmbedsError(null)

    const { error } = await supabase
      .from("standalone_embeds")
      .update({ status: "pending" })
      .eq("id", embedId)

    setSubmittingEmbedId(null)

    if (error) {
      setEmbedsError(error.message)
      return
    }

    setEmbeds((current) =>
      current.map((embed) =>
        embed.id === embedId ? { ...embed, status: "pending" } : embed
      )
    )
  }

  React.useEffect(() => {
    if (!user) return

    let cancelled = false

    supabase
      .from("projects")
      .select("id, name, status, is_premium, submission_comment")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProjectsError(error.message)
        } else {
          setProjectsError(null)
          setProjects(data)
        }
        setProjectsLoadedFor(user.id)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  async function submitForReview(projectId: string) {
    setSubmittingId(projectId)
    setSubmitError(null)

    const { error } = await supabase
      .from("projects")
      .update({
        status: "pending",
        submission_comment: comments[projectId]?.trim() || null,
      })
      .eq("id", projectId)

    setSubmittingId(null)

    if (error) {
      setSubmitError(error.message)
      return
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: "pending",
              submission_comment: comments[projectId]?.trim() || null,
            }
          : project
      )
    )
    setExpandedId(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border p-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-xl border p-10 text-center">
        <p className="text-lg font-semibold">Sign in to submit a project</p>
        <p className="mt-2 text-muted-foreground">
          Create an account to add project details and send them for review.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-semibold">Your projects</p>
          <Button variant="outline" asChild>
            <Link href="/account/create-project">
              <Plus className="size-4" />
              Create project
            </Link>
          </Button>
        </div>

        {projectsLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading projects
          </div>
        ) : projectsError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {projectsError}
          </p>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You haven&rsquo;t created a project yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {projects.map((project) => {
              const canSubmit =
                project.status === "draft" || project.status === "rejected"
              const isExpanded = expandedId === project.id

              return (
                <li key={project.id} className="rounded-lg border p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="min-w-0 truncate font-medium">
                      {project.name}
                    </p>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {project.is_premium ? "Premium" : "Free"}
                      </span>
                      <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {statusLabel[project.status]}
                      </span>
                    </span>
                  </div>

                  {project.status === "pending" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Submitted for moderation and can&rsquo;t be edited until
                      it&rsquo;s reviewed.
                    </p>
                  )}

                  {canSubmit && (
                    <div className="mt-3">
                      {isExpanded ? (
                        <div className="flex flex-col gap-2">
                          <Textarea
                            placeholder="Anything reviewers should know? (optional)"
                            value={comments[project.id] ?? ""}
                            onChange={(event) =>
                              setComments((current) => ({
                                ...current,
                                [project.id]: event.target.value,
                              }))
                            }
                            maxLength={500}
                          />
                          {submitError && (
                            <p
                              className="text-sm text-destructive"
                              role="alert"
                            >
                              {submitError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void submitForReview(project.id)}
                              disabled={submittingId === project.id}
                            >
                              {submittingId === project.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Mail className="size-4" />
                              )}
                              Submit for review
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(project.id)}
                        >
                          <Mail className="size-4" />
                          Submit for review
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-semibold">Your embeds</p>
          <Button variant="outline" asChild>
            <Link href="/account/create-embed">
              <Plus className="size-4" />
              Create embed
            </Link>
          </Button>
        </div>

        {embedsLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading embeds
          </div>
        ) : (
          <>
            {embedsError && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {embedsError}
              </p>
            )}
            {embeds.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                You haven&rsquo;t created an embed yet.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {embeds.map((embed) => (
                  <li key={embed.id} className="rounded-lg border p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="min-w-0 truncate font-medium">
                        {embed.title}
                      </p>
                      <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {embedStatusLabel[embed.status]}
                      </span>
                    </div>
                    {(embed.status === "draft" ||
                      embed.status === "rejected") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => void submitEmbedForReview(embed.id)}
                        disabled={submittingEmbedId === embed.id}
                      >
                        {submittingEmbedId === embed.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Mail className="size-4" />
                        )}
                        Submit for review
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export { SubmitProjectPanel }
