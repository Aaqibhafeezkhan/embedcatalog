"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "components/auth-provider"
import { supabase } from "lib/supabase/client"

const SETUP_PATH = "/account/setup-profile"

export function AccountGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const [isConfirmed, setIsConfirmed] = React.useState<boolean | null>(null)
  const isSetupPage = pathname === SETUP_PATH
  const userId = user?.id

  React.useEffect(() => {
    if (!userId) return

    let cancelled = false
    setIsConfirmed(null)
    void supabase
      .from("profiles")
      .select("is_confirmed")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setIsConfirmed(data?.is_confirmed ?? false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, pathname])

  React.useEffect(() => {
    if (isConfirmed === null) return
    if (!isConfirmed && !isSetupPage) router.replace(SETUP_PATH)
    else if (isConfirmed && isSetupPage) router.replace("/account")
  }, [isConfirmed, isSetupPage, router])

  // Unauthenticated users are handled by the individual pages.
  if (loading || !user) return children

  if (isConfirmed === null || isConfirmed === isSetupPage) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return children
}
