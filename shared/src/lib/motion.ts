export const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const

export const PAGE_TRANSITION = {
  type: "tween" as const,
  ease: EASE_OUT_QUART,
  duration: 0.28,
}

export const MORPH_LAYOUT_TRANSITION = {
  layout: {
    type: "tween" as const,
    ease: EASE_OUT_QUART,
    duration: 0.24,
  },
}
