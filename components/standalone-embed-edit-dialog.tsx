"use client"

import * as React from "react"

import { Button } from "components/ui/button"
import { Input } from "components/ui/input"
import { Label } from "components/ui/label"
import { Textarea } from "components/ui/textarea"
import type { Database } from "lib/supabase/database"
import { isValidEmbedSlug, slugifyEmbed } from "lib/standalone-embed-slug"
import { supabase } from "lib/supabase/client"

type StandaloneEmbed = Database["public"]["Tables"]["standalone_embeds"]["Row"]

type StandaloneEmbedEditDialogProps = {
  embed: StandaloneEmbed
  open: boolean
  requiresModeration?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (embed: StandaloneEmbed) => void
  onModerationSubmitted?: () => void
}

const maxEdits = 20

function StandaloneEmbedEditDialog({
  embed,
  open,
  requiresModeration = false,
  onOpenChange,
  onSaved,
  onModerationSubmitted,
}: StandaloneEmbedEditDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const [title, setTitle] = React.useState(embed.title)
  const [imageTitle, setImageTitle] = React.useState(embed.image_title)
  const [description, setDescription] = React.useState(embed.image_description)
  const [slug, setSlug] = React.useState(embed.slug)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const editsRemaining = Math.max(0, maxEdits - embed.edit_count)

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function closeEditor() {
    dialogRef.current?.close()
    onOpenChange(false)
  }

  async function saveEmbed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    const nextSlug = slugifyEmbed(slug.trim() || nextTitle)

    if (!nextTitle) {
      setError("Enter a name for your embed.")
      return
    }
    if (!isValidEmbedSlug(nextSlug)) {
      setError("Use lowercase letters, numbers, and hyphens for the embed URL.")
      return
    }

    setSaving(true)
    setError(null)

    if (requiresModeration) {
      const { error: requestError } = await supabase
        .from("standalone_embed_edit_requests")
        .insert({
          embed_id: embed.id,
          owner_id: embed.owner_id,
          slug: nextSlug,
          title: nextTitle,
          image_title: imageTitle.trim(),
          image_description: description.trim(),
        })

      setSaving(false)
      if (requestError) {
        setError(requestError.message)
        return
      }

      onModerationSubmitted?.()
      closeEditor()
      return
    }

    const { data, error: updateError } = await supabase
      .from("standalone_embeds")
      .update({
        title: nextTitle,
        image_title: imageTitle.trim(),
        image_description: description.trim(),
        slug: nextSlug,
      })
      .eq("id", embed.id)
      .eq("owner_id", embed.owner_id)
      .select(
        "id, owner_id, slug, title, description, image_title, image_description, project_id, status, views_count, upvotes_count, edit_count, created_at"
      )
      .single()

    setSaving(false)
    if (updateError || !data) {
      setError(
        updateError?.code === "23505"
          ? "An embed with this embed URL already exists in your account."
          : (updateError?.message ?? "Could not save this embed.")
      )
      return
    }

    onSaved(data)
    setTitle(data.title)
    setImageTitle(data.image_title)
    setDescription(data.image_description)
    setSlug(data.slug)
    closeEditor()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`edit-embed-title-${embed.id}`}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) closeEditor()
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border bg-background p-0 text-left text-foreground backdrop:bg-black/50"
    >
      <form onSubmit={(event) => void saveEmbed(event)} className="p-6">
        <h2
          id={`edit-embed-title-${embed.id}`}
          className="text-lg font-semibold"
        >
          Edit embed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {editsRemaining} edits remaining. Editing ends 24 hours after
          creation.
        </p>
        {requiresModeration && (
          <p className="mt-2 text-sm text-muted-foreground">
            Changes to embeds on published projects are reviewed before they go
            live.
          </p>
        )}
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`edit-embed-name-${embed.id}`}>Name</Label>
            <Input
              id={`edit-embed-name-${embed.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-embed-url-${embed.id}`}>Embed URL</Label>
            <Input
              id={`edit-embed-url-${embed.id}`}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and hyphens.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-embed-image-title-${embed.id}`}>Title</Label>
            <Input
              id={`edit-embed-image-title-${embed.id}`}
              value={imageTitle}
              onChange={(event) => setImageTitle(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-embed-description-${embed.id}`}>
              Description
            </Label>
            <Textarea
              id={`edit-embed-description-${embed.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={160}
            />
          </div>
        </div>
        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={closeEditor}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving" : "Save changes"}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

export { StandaloneEmbedEditDialog }
