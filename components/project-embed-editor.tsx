"use client"

import * as React from "react"
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

import { Button } from "components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "components/ui/card"
import { Input } from "components/ui/input"
import { Label } from "components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/ui/select"
import { Textarea } from "components/ui/textarea"
import type { CreateProjectEmbed } from "app/account/create-project/draft-context"
import { cn } from "lib/utils"
import {
  bindGithubRepo,
  githubVariables,
  isValidGithubRepo,
  type GithubVariableKey,
} from "lib/embed-variables"
import { slugifyEmbed } from "lib/standalone-embed-slug"

type EmbedProject = {
  id: string
  name: string
  status: string
}

type ProjectEmbedEditorProps = {
  embeds: CreateProjectEmbed[]
  onEmbedsChange: (embeds: CreateProjectEmbed[]) => void
  fallbackTitle?: string
  defaultEmbedName?: string
  maxEmbeds?: number
  showSlug?: boolean
  addInDialog?: boolean
  projects?: EmbedProject[]
  selectedProjectIds?: Record<number, string>
  onProjectChange?: (embedId: number, projectId: string | null) => void
}

const defaultEmbed = (id: number): CreateProjectEmbed => ({
  id,
  title: "Built with EmbedCatalog",
  description: "A project worth checking out.",
  theme: "light",
})

function getEmbedColors(theme: CreateProjectEmbed["theme"]) {
  return theme === "dark"
    ? {
        background: "#171717",
        border: "#404040",
        text: "#fafafa",
        muted: "#a3a3a3",
      }
    : {
        background: "#ffffff",
        border: "#d4d4d4",
        text: "#171717",
        muted: "#737373",
      }
}

function ThemeSwitch({
  theme,
  onThemeChange,
}: {
  theme: CreateProjectEmbed["theme"]
  onThemeChange: (theme: CreateProjectEmbed["theme"]) => void
}) {
  const isDark = theme === "dark"

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "text-xs",
          !isDark ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        Light
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle embed theme"
        onClick={() => onThemeChange(isDark ? "light" : "dark")}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          isDark ? "border-foreground bg-foreground" : "border-border bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
            isDark && "translate-x-4"
          )}
        />
      </button>
      <span
        className={cn(
          "text-xs",
          isDark ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        Dark
      </span>
    </div>
  )
}

function EmbedPreview({
  embed,
  fallbackTitle,
}: {
  embed: CreateProjectEmbed
  fallbackTitle?: string
}) {
  const colors = getEmbedColors(embed.theme)

  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed bg-muted/40 p-5">
      <div
        className="w-full max-w-xs rounded border p-4"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          color: colors.text,
        }}
      >
        <p className="text-sm leading-5 font-semibold">
          {embed.title || fallbackTitle || "Untitled embed"}
        </p>
        {embed.description && (
          <p
            className="mt-1 text-xs leading-[18px]"
            style={{ color: colors.muted }}
          >
            {embed.description}
          </p>
        )}
      </div>
    </div>
  )
}

function AddEmbedDialog({
  open,
  showSlug,
  defaultName,
  editingEmbed,
  onOpenChange,
  onAdd,
  onSave,
}: {
  open: boolean
  showSlug: boolean
  defaultName?: string
  editingEmbed: CreateProjectEmbed | null
  onOpenChange: (open: boolean) => void
  onAdd: (embed: CreateProjectEmbed) => void
  onSave: (embed: CreateProjectEmbed) => void
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const titleRef = React.useRef<HTMLInputElement>(null)
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null)
  const lastField = React.useRef<"title" | "description">("title")
  const [githubOpen, setGithubOpen] = React.useState(true)
  const [repo, setRepo] = React.useState("")
  const [draft, setDraft] = React.useState<CreateProjectEmbed>(() =>
    defaultEmbed(Date.now())
  )

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setDraft(
        editingEmbed ?? { ...defaultEmbed(Date.now()), name: defaultName }
      )
      setRepo(editingEmbed?.githubRepo ?? "")
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [defaultName, editingEmbed, open])

  function insertVariable(key: GithubVariableKey) {
    const field = lastField.current
    const element =
      field === "title" ? titleRef.current : descriptionRef.current
    const token = `{{${key}}}`
    const value = draft[field]
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    setDraft({
      ...draft,
      [field]: `${value.slice(0, start)}${token}${value.slice(end)}`,
    })
    element?.focus()
  }

  const repoValid = isValidGithubRepo(repo.trim())

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const updatedEmbed = {
      ...draft,
      githubRepo: repoValid ? repo.trim() : undefined,
    }
    if (editingEmbed) onSave(updatedEmbed)
    else onAdd(updatedEmbed)
    onOpenChange(false)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="add-embed-title"
      onCancel={() => onOpenChange(false)}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg border bg-background p-0 text-left text-foreground backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="add-embed-title" className="text-lg font-semibold">
            {editingEmbed ? "Edit embed" : "Add embed"}
          </h2>
          <div className="flex items-center gap-3">
            <ThemeSwitch
              theme={draft.theme}
              onThemeChange={(theme) => setDraft({ ...draft, theme })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-6 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <nav
            aria-label="Embed variables"
            className="grid content-start gap-2"
          >
            <button
              type="button"
              aria-expanded={githubOpen}
              onClick={() => setGithubOpen(!githubOpen)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  githubOpen && "rotate-90"
                )}
              />
              GitHub
            </button>
            {githubOpen && (
              <div className="grid gap-2 pl-3">
                <Input
                  value={repo}
                  onChange={(event) => setRepo(event.target.value)}
                  placeholder="owner/repo"
                  aria-label="GitHub repository"
                  maxLength={100}
                />
                <ul className="grid gap-0.5">
                  {githubVariables.map((variable) => (
                    <li key={variable.key}>
                      <button
                        type="button"
                        disabled={!repoValid}
                        onClick={() => insertVariable(variable.key)}
                        className="w-full rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        {variable.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Enter a repository, then click a variable to insert it.
                </p>
              </div>
            )}
          </nav>
          <div className="grid gap-4">
            {showSlug && (
              <div className="grid gap-2">
                <Label htmlFor="add-embed-label">Name</Label>
                <Input
                  id="add-embed-label"
                  value={draft.name ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="Shown in your embed list"
                  maxLength={80}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="add-embed-name">Title</Label>
              <Input
                id="add-embed-name"
                ref={titleRef}
                onFocus={() => (lastField.current = "title")}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                maxLength={80}
              />
            </div>
            {showSlug && (
              <div className="grid gap-2">
                <Label htmlFor="add-embed-slug">Embed URL</Label>
                <Input
                  id="add-embed-slug"
                  value={draft.slug ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, slug: event.target.value })
                  }
                  placeholder={slugifyEmbed(draft.name ?? "")}
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use {slugifyEmbed(draft.name ?? "")}. Use
                  lowercase letters, numbers, and hyphens.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="add-embed-description">Description</Label>
              <Textarea
                id="add-embed-description"
                ref={descriptionRef}
                onFocus={() => (lastField.current = "description")}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                maxLength={160}
              />
            </div>
            <EmbedPreview embed={draft} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={showSlug ? !draft.name?.trim() : !draft.title.trim()}
          >
            {editingEmbed ? "Save changes" : "Add embed"}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

function ProjectEmbedEditor({
  embeds,
  onEmbedsChange,
  fallbackTitle,
  defaultEmbedName,
  maxEmbeds,
  showSlug = false,
  addInDialog = false,
  projects,
  selectedProjectIds,
  onProjectChange,
}: ProjectEmbedEditorProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingEmbedId, setEditingEmbedId] = React.useState<number | null>(
    null
  )
  const standaloneDrafts = showSlug && addInDialog

  function updateEmbed(id: number, changes: Partial<CreateProjectEmbed>) {
    onEmbedsChange(
      embeds.map((embed) =>
        embed.id === id ? { ...embed, ...changes } : embed
      )
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Embeds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize each embed to fit its purpose.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={maxEmbeds !== undefined && embeds.length >= maxEmbeds}
          onClick={() => {
            if (addInDialog) {
              setEditingEmbedId(null)
              setDialogOpen(true)
            } else {
              onEmbedsChange([...embeds, defaultEmbed(Date.now())])
            }
          }}
        >
          <Plus className="size-4" />
          Add embed
        </Button>
      </div>
      {addInDialog && (
        <AddEmbedDialog
          open={dialogOpen}
          showSlug={showSlug}
          defaultName={defaultEmbedName}
          editingEmbed={
            embeds.find((embed) => embed.id === editingEmbedId) ?? null
          }
          onOpenChange={setDialogOpen}
          onAdd={(embed) => onEmbedsChange([...embeds, embed])}
          onSave={(embed) => {
            if (editingEmbedId !== null) updateEmbed(editingEmbedId, embed)
          }}
        />
      )}
      {embeds.length === 0 && (
        <p className="text-sm text-muted-foreground">No embeds yet.</p>
      )}
      {embeds.map((embed, index) => {
        return (
          <Card key={embed.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {standaloneDrafts
                  ? embed.name || `Embed ${index + 1}`
                  : `Embed ${index + 1}`}
              </CardTitle>
              <CardAction className="flex items-center gap-2">
                {standaloneDrafts ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${embed.name || `embed ${index + 1}`}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="z-50 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <DropdownMenu.Item
                          onSelect={() => {
                            setEditingEmbedId(embed.id)
                            setDialogOpen(true)
                          }}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() =>
                            onEmbedsChange(
                              embeds.filter((item) => item.id !== embed.id)
                            )
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent focus:bg-accent"
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                ) : (
                  <>
                    <ThemeSwitch
                      theme={embed.theme}
                      onThemeChange={(theme) =>
                        updateEmbed(embed.id, { theme })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Remove embed ${index + 1}`}
                      onClick={() =>
                        onEmbedsChange(
                          embeds.filter((item) => item.id !== embed.id)
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </CardAction>
            </CardHeader>
            {standaloneDrafts ? (
              <CardContent className="grid gap-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Embed URL</dt>
                    <dd className="text-sm break-all">
                      {embed.slug?.trim() || slugifyEmbed(embed.name ?? "")}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Title</dt>
                    <dd className="text-sm break-words">{embed.title}</dd>
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Description
                    </dt>
                    <dd className="text-sm break-words">
                      {embed.description || "No description"}
                    </dd>
                  </div>
                </dl>
                <EmbedPreview embed={embed} fallbackTitle={fallbackTitle} />
              </CardContent>
            ) : (
              <>
                <CardContent className="grid gap-5">
                  {showSlug && (
                    <div className="grid gap-2">
                      <Label htmlFor={`embed-label-${embed.id}`}>Name</Label>
                      <Input
                        id={`embed-label-${embed.id}`}
                        value={embed.name ?? ""}
                        onChange={(event) =>
                          updateEmbed(embed.id, { name: event.target.value })
                        }
                        placeholder="Shown in your embed list"
                        maxLength={80}
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor={`embed-title-${embed.id}`}>Title</Label>
                    <Input
                      id={`embed-title-${embed.id}`}
                      value={embed.title}
                      onChange={(event) =>
                        updateEmbed(embed.id, { title: event.target.value })
                      }
                      maxLength={80}
                    />
                  </div>
                  {showSlug && (
                    <div className="grid gap-2">
                      <Label htmlFor={`embed-slug-${embed.id}`}>
                        Embed URL
                      </Label>
                      <Input
                        id={`embed-slug-${embed.id}`}
                        value={embed.slug ?? ""}
                        onChange={(event) =>
                          updateEmbed(embed.id, { slug: event.target.value })
                        }
                        placeholder={slugifyEmbed(embed.name ?? "")}
                        maxLength={80}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use {slugifyEmbed(embed.name ?? "")}. Use
                        lowercase letters, numbers, and hyphens.
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor={`embed-description-${embed.id}`}>
                      Description
                    </Label>
                    <Textarea
                      id={`embed-description-${embed.id}`}
                      value={embed.description}
                      onChange={(event) =>
                        updateEmbed(embed.id, {
                          description: event.target.value,
                        })
                      }
                      maxLength={160}
                    />
                  </div>
                  {projects && onProjectChange && (
                    <div className="grid gap-2">
                      <Label htmlFor={`embed-project-${embed.id}`}>
                        Project
                      </Label>
                      <Select
                        value={selectedProjectIds?.[embed.id] || "none"}
                        onValueChange={(value) =>
                          onProjectChange(
                            embed.id,
                            value === "none" ? null : value
                          )
                        }
                      >
                        <SelectTrigger id={`embed-project-${embed.id}`}>
                          <SelectValue placeholder="Not linked to a project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} ({project.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
                <CardContent className="border-t pt-6">
                  <EmbedPreview embed={embed} fallbackTitle={fallbackTitle} />
                </CardContent>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export { ProjectEmbedEditor }
