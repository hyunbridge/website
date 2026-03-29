"use client"

import type React from "react"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  AUTH_TOKEN_STORAGE_KEY,
  isApiError,
  request,
  setAuthToken,
} from "../lib/api-client"

export type AdminUser = {
  id: string
  email: string
  role: string
}

type AuthContextType = {
  user: AdminUser | null
  session: { access_token: string } | null
  isLoading: boolean
  bootstrapError: string | null
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>
  signOut: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchMe() {
  return request<AdminUser>("/admin/me", { auth: true })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [session, setSession] = useState<{ access_token: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      setIsLoading(true)
      const token =
        typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null
      try {
        if (!token) {
          if (mounted) {
            setUser(null)
            setSession(null)
            setBootstrapError(null)
          }
          return
        }

        const nextUser = await fetchMe()
        if (!mounted) return
        setUser(nextUser)
        setSession({ access_token: token })
        setBootstrapError(null)
      } catch (error) {
        if (!mounted) return

        if (isApiError(error) && (error.status === 401 || error.status === 403)) {
          setAuthToken(null)
          setUser(null)
          setSession(null)
          setBootstrapError(null)
          return
        }

        setUser(null)
        setSession(token ? { access_token: token } : null)
        setBootstrapError(
          error instanceof Error ? error.message : "인증 상태를 확인하지 못했습니다.",
        )
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      bootstrapError,
      async signIn(email: string, password: string, captchaToken?: string) {
        const response = await request<{ accessToken: string; expiresIn: number }>("/admin/login", {
          method: "POST",
          body: { email, password, captchaToken },
        })
        setAuthToken(response.accessToken)
        const nextUser = await fetchMe()
        setUser(nextUser)
        setSession({ access_token: response.accessToken })
        setBootstrapError(null)
      },
      async signOut() {
        setAuthToken(null)
        setUser(null)
        setSession(null)
        setBootstrapError(null)
      },
      async logout() {
        setAuthToken(null)
        setUser(null)
        setSession(null)
        setBootstrapError(null)
      },
    }),
    [bootstrapError, isLoading, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
