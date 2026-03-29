"use client"

import type { ReactNode } from "react"
import { toast as sonnerToast } from "sonner"

type ToastInput = {
  title?: ReactNode
  description?: ReactNode
  variant?: "default" | "destructive"
}

function getToastMessage({ title, description }: ToastInput) {
  if (typeof title === "string" && title.length > 0) {
    return title
  }

  if (typeof description === "string" && description.length > 0) {
    return description
  }

  return "알림"
}

function getToastOptions({ description }: ToastInput) {
  return description ? { description } : undefined
}

function toast(input: ToastInput) {
  const show = input.variant === "destructive" ? sonnerToast.error : sonnerToast
  return show(getToastMessage(input), getToastOptions(input))
}

function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
    toasts: [],
  }
}

export { useToast, toast }
