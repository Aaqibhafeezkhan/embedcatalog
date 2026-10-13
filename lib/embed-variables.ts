import { formatCount, parseLinkHeaderTotal } from "lib/github"

const githubVariables = [
  { key: "stars", label: "Stars" },
  { key: "forks", label: "Forks" },
  { key: "watchers", label: "Watchers" },
  { key: "contributors", label: "Contributors" },
  { key: "issues", label: "Open issues" },
  { key: "license", label: "License" },
  { key: "language", label: "Language" },
] as const

type GithubVariableKey = (typeof githubVariables)[number]["key"]
type GithubValues = Record<GithubVariableKey, string>

const repoPattern = /^[\w.-]+\/[\w.-]+$/
const tokenPattern = /\{github:([\w.-]+\/[\w.-]+):(\w+)\}/g
const maxRepos = 3

function githubToken(repo: string, key: GithubVariableKey) {
  return `{github:${repo}:${key}}`
}

function isValidGithubRepo(repo: string) {
  return repoPattern.test(repo)
}

// Turns the short `{{stars}}` form into a full token bound to a repository.
function bindGithubRepo(text: string, repo: string | undefined) {
  if (!repo || !isValidGithubRepo(repo)) return text
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    githubVariables.some((variable) => variable.key === key)
      ? githubToken(repo, key as GithubVariableKey)
      : match
  )
}

async function fetchGithubValues(repo: string): Promise<GithubValues | null> {
  // Token is only defined on the server; the browser preview stays unauthenticated.
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  try {
    const [repoRes, contributorsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, {
        headers,
        next: { revalidate: 3600 },
      }),
      fetch(
        `https://api.github.com/repos/${repo}/contributors?per_page=1&anon=true`,
        { headers, next: { revalidate: 3600 } }
      ),
    ])
    if (!repoRes.ok) return null

    const data = (await repoRes.json()) as {
      stargazers_count?: number
      forks_count?: number
      subscribers_count?: number
      open_issues_count?: number
      license?: { spdx_id?: string | null } | null
      language?: string | null
    }

    let contributors: number | null = null
    if (contributorsRes.ok) {
      contributors = parseLinkHeaderTotal(contributorsRes.headers.get("link"))
      if (contributors === null) {
        const list = (await contributorsRes.json()) as unknown[]
        contributors = Array.isArray(list) ? list.length : null
      }
    }

    const spdx = data.license?.spdx_id
    return {
      stars: formatCount(data.stargazers_count ?? 0),
      forks: formatCount(data.forks_count ?? 0),
      watchers: formatCount(data.subscribers_count ?? 0),
      contributors: contributors === null ? "—" : formatCount(contributors),
      issues: formatCount(data.open_issues_count ?? 0),
      license: spdx && spdx !== "NOASSERTION" ? spdx : "—",
      language: data.language ?? "—",
    }
  } catch {
    return null
  }
}

async function resolveEmbedText(text: string) {
  const repos = [
    ...new Set(Array.from(text.matchAll(tokenPattern), (match) => match[1])),
  ].slice(0, maxRepos)
  if (repos.length === 0) return text

  const entries = await Promise.all(
    repos.map(async (repo) => [repo, await fetchGithubValues(repo)] as const)
  )
  const values = new Map(entries)

  return text.replace(tokenPattern, (_token, repo: string, key: string) => {
    const repoValues = values.get(repo)
    return repoValues?.[key as GithubVariableKey] ?? "—"
  })
}

export {
  bindGithubRepo,
  githubToken,
  githubVariables,
  isValidGithubRepo,
  resolveEmbedText,
  type GithubVariableKey,
}
