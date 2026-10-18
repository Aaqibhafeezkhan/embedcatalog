"use client"

import * as React from "react"
import Image from "next/image"
import { Check, Copy, Loader2 } from "lucide-react"

import { siteConfig } from "lib/site"
import {
  getContributors,
  getOpenIssues,
  type GithubContributor,
  type GithubIssue,
} from "lib/hacktoberfest"

function HacktoberfestCommunity() {
  const [issues, setIssues] = React.useState<GithubIssue[]>([])
  const [contributors, setContributors] = React.useState<GithubContributor[]>(
    []
  )
  const [copiedLogin, setCopiedLogin] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    Promise.all([getOpenIssues(), getContributors()]).then(
      ([loadedIssues, loadedContributors]) => {
        if (cancelled) return
        setIssues(loadedIssues)
        setContributors(loadedContributors)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
    }
  }, [])

  async function copyEmbedCode(contributor: GithubContributor) {
    const imageUrl = `${siteConfig.url}/embed/hacktoberfest-2026/${contributor.login}.png`
    const code = `<a href="${contributor.url}" target="_blank" rel="noreferrer noopener"><img src="${imageUrl}" alt="Hacktoberfest 2026 contributor badge for ${contributor.login}" width="320" height="84" /></a>`

    try {
      await navigator.clipboard.writeText(code)
      setCopiedLogin(contributor.login)
      setTimeout(() => setCopiedLogin(null), 2000)
    } catch {
      // Clipboard API unavailable.
    }
  }

  if (loading) {
    return (
      <div className="mt-10 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Open issues</h2>
        {issues.length > 0 ? (
          <ul className="mt-4 divide-y rounded-lg border">
            {issues.map((issue) => (
              <li key={issue.id}>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-medium">
                    {issue.title}{" "}
                    <span className="font-normal text-muted-foreground">
                      #{issue.number}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>by {issue.author}</span>
                    <span>{issue.comments} comments</span>
                    {issue.labels.map((label) => (
                      <span
                        key={label.name}
                        className="rounded-full border px-2 py-0.5"
                        style={{ borderColor: `#${label.color}` }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No open issues right now.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Contributors</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get your unique Hacktoberfest 2026 embed.
        </p>
        {contributors.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {contributors.map((contributor) => (
              <li key={contributor.login}>
                <div className="flex flex-col items-center gap-2">
                  <a
                    href={contributor.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-2"
                  >
                    <Image
                      src={contributor.avatarUrl}
                      alt={contributor.login}
                      width={64}
                      height={64}
                      unoptimized
                      className="size-16 rounded-full"
                    />
                    <span className="max-w-full truncate text-sm">
                      {contributor.login}
                    </span>
                  </a>
                  <a
                    href={`/embed/hacktoberfest-2026/${contributor.login}.png`}
                    download={`${contributor.login}-hacktoberfest-2026.png`}
                    aria-label={`Download ${contributor.login}'s Hacktoberfest 2026 badge`}
                  >
                    <Image
                      src={`/embed/hacktoberfest-2026/${contributor.login}.png`}
                      alt={`Hacktoberfest 2026 contributor badge for ${contributor.login}`}
                      width={320}
                      height={84}
                      unoptimized
                      className="h-auto w-full max-w-64"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyEmbedCode(contributor)}
                    aria-label={`Copy ${contributor.login}'s Hacktoberfest embed code`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedLogin === contributor.login ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedLogin === contributor.login
                      ? "Copied"
                      : "Copy embed code"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No contributors to show.
          </p>
        )}
      </section>
    </>
  )
}

export { HacktoberfestCommunity }
