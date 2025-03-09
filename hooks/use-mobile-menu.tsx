"use client"

import { create } from "zustand"

interface MobileMenuState {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  toggle: () => void
}

export const useMobileMenu = create<MobileMenuState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))

