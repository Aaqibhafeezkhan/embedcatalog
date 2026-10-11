"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bookmark, LoaderCircle } from "lucide-react"

import { useAuth } from "components/auth-provider"
import { Button } from "components/ui/button"
import { supabase } from "lib/supabase/client"

function EmbedBookmark({ embedId }: { embedId: string }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [isBookmarked, setIsBookmarked] = React.useState(false)
  const [resolvedUserId, setResolvedUserId] = React.useState<string | null>(
    null
  )
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestInProgress = React.useRef(false)

  React.useEffect(() => {
    if (!user) return

    let cancelled = false
    supabase
      .from("standalone_embed_bookmarks")
      .select("embed_id")
      .eq("embed_id", embedId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setIsBookmarked(Boolean(data))
        setResolvedUserId(user.id)
      })

    return () => {
      cancelled = true
    }
  }, [embedId, user])

  async function toggleBookmark() {
    if (!user) {
      router.push("/login")
      return
    }
    if (requestInProgress.current || resolvedUserId !== user.id) return

    requestInProgress.current = true
    setSaving(true)
    setError(null)

    const result = isBookmarked
      ? await supabase
          .from("standalone_embed_bookmarks")
          .delete()
          .eq("embed_id", embedId)
          .eq("user_id", user.id)
      : await supabase
          .from("standalone_embed_bookmarks")
          .insert({ embed_id: embedId, user_id: user.id })

    if (result.error) {
      setError("Could not update your bookmark. Please try again.")
    } else {
      setIsBookmarked(!isBookmarked)
    }

    setSaving(false)
    requestInProgress.current = false
  }

  const checkingBookmark = Boolean(user) && resolvedUserId !== user?.id
  const label = isBookmarked
    ? "Remove embed bookmark"
    : user
      ? "Bookmark embed"
      : "Sign in to bookmark"

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={isBookmarked ? "secondary" : "outline"}
        size="icon"
        onClick={() => void toggleBookmark()}
        disabled={authLoading || checkingBookmark || saving}
        aria-label={label}
        aria-pressed={isBookmarked}
        title={label}
      >
        {saving || checkingBookmark ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Bookmark
            className="size-4"
            fill={isBookmarked ? "currentColor" : "none"}
          />
        )}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export { EmbedBookmark }
