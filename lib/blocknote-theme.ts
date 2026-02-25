import type { Theme } from "@blocknote/mantine"

export const BLOCKNOTE_APP_FONT_FAMILY =
  'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'

export const BLOCKNOTE_APP_THEME: Theme = {
  colors: {
    editor: {
      text: "hsl(var(--foreground))",
      background: "hsl(var(--background))",
    },
    menu: {
      text: "hsl(var(--popover-foreground))",
      background: "hsl(var(--popover))",
    },
    tooltip: {
      text: "hsl(var(--popover-foreground))",
      background: "hsl(var(--popover))",
    },
    hovered: {
      text: "hsl(var(--accent-foreground))",
      background: "hsl(var(--accent))",
    },
    selected: {
      text: "hsl(var(--primary-foreground))",
      background: "hsl(var(--primary))",
    },
    disabled: {
      text: "hsl(var(--muted-foreground))",
      background: "hsl(var(--muted))",
    },
    shadow: "hsl(var(--border))",
    border: "hsl(var(--border))",
    sideMenu: "hsl(var(--muted-foreground))",
  },
  borderRadius: 8,
  fontFamily: BLOCKNOTE_APP_FONT_FAMILY,
}
