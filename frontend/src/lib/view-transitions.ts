const VIEW_TRANSITION_PREFIX = "vt"

function sanitize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
}

export function getViewTransitionName(
  kind: "blog" | "project",
  itemId: string,
  part: "image" | "title" | "card",
) {
  return `${VIEW_TRANSITION_PREFIX}-${kind}-${part}-${sanitize(itemId)}`
}
