function slugifyEmbed(value: string) {
  return (
    value
      .replace(/\{+[^}]*\}+/g, " ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "embed"
  )
}

function isValidEmbedSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export { isValidEmbedSlug, slugifyEmbed }
