"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, UserRound } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card"
import { supabase } from "lib/supabase/client"

type FollowedProfile = {
  id: string
  slug: string
  display_name: string | null
  avatar_url: string | null
}

function FollowingList({ userId }: { userId: string }) {
  const [profiles, setProfiles] = React.useState<FollowedProfile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: follows, error: followsError } = await supabase
        .from("user_follows")
        .select("followed_id, created_at")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false })

      if (cancelled) return
      if (followsError) {
        setError(followsError.message)
        setLoading(false)
        return
      }

      const ids = (follows ?? []).map((follow) => follow.followed_id)
      if (ids.length === 0) {
        setProfiles([])
        setLoading(false)
        return
      }

      const { data, error: profilesError } = await supabase.rpc(
        "get_public_profiles",
        { p_profile_ids: ids }
      )

      if (cancelled) return
      if (profilesError) {
        setError(profilesError.message)
      } else {
        const byId = new Map(
          (data ?? []).map((profile) => [profile.id, profile])
        )
        setProfiles(ids.flatMap((id) => byId.get(id) ?? []))
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Following</CardTitle>
        <CardDescription>
          Profiles you follow. Only you can see this list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading
          </div>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Could not load following: {error}
          </p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not following anyone yet.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <Link
                  href={`/user/${encodeURIComponent(profile.slug)}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <UserRound className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {profile.display_name || profile.slug}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{profile.slug}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { FollowingList }
