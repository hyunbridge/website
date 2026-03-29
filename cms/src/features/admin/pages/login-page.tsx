"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "@/lib/app-router"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@shared/components/ui/button"
import { Input } from "@shared/components/ui/input"
import { Label } from "@shared/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card"
import { Skeleton } from "@shared/components/ui/skeleton"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import { Turnstile } from "@marsidev/react-turnstile"
import { Loader2, AlertCircle } from "lucide-react"
import { TURNSTILE_SITE_KEY } from "@/lib/env"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminLoginPage() {
  const { user, signIn, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [isCaptchaLoaded, setIsCaptchaLoaded] = useState(false)

  const siteKey = TURNSTILE_SITE_KEY
  const requiresCaptcha = Boolean(siteKey)
  const hasCaptchaConfigurationError = import.meta.env.PROD && !requiresCaptcha

  useEffect(() => {
    if (user) {
      router.push("/")
    }
  }, [user, router])

  useEffect(() => {
    setCaptchaToken(null)
    setIsCaptchaLoaded(false)
  }, [siteKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해주세요.")
      return
    }

    if (!email.includes("@")) {
      setError("올바른 이메일 주소를 입력해주세요.")
      return
    }

    if (hasCaptchaConfigurationError) {
      setError("로그인 구성이 올바르지 않습니다. 관리자에게 문의해주세요.")
      return
    }

    if (requiresCaptcha && !captchaToken) {
      setError("로그인 전에 CAPTCHA 인증을 완료해주세요.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await signIn(email, password, captchaToken || undefined)
      router.push("/")
    } catch (err: unknown) {
      console.error("Login error:", err)

      // Provide more specific error messages
      let errorMessage = "로그인에 실패했습니다. 다시 시도해주세요."

      if (err instanceof Error && err.message.includes("Invalid login credentials")) {
        errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해주세요."
      } else if (err instanceof Error && err.message.includes("Email not confirmed")) {
        errorMessage = "로그인 전에 이메일에서 계정 인증을 완료해주세요."
      } else if (err instanceof Error && err.message.includes("Too many requests")) {
        errorMessage = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요."
      } else if (err instanceof Error && err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="w-full border-border/50 shadow-sm">
            <CardHeader className="space-y-3 pb-6">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex justify-center pt-2">
                <Skeleton className="h-[65px] w-[300px]" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <Card className="w-full border-border/50 shadow-lg shadow-black/5 bg-card">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-2 pb-6 text-center">
              <div className="mx-auto bg-primary/5 w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-sm border border-primary/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-primary"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <CardTitle className="text-2xl font-semibold tracking-tight">관리자 로그인</CardTitle>
              <CardDescription className="text-muted-foreground font-medium">
                관리자 대시보드에 접속하려면 계정 정보를 입력해주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Alert
                      variant="destructive"
                      className="bg-destructive/5 text-destructive border-destructive/20 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive/50" />
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="ml-1 font-medium">{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium text-foreground/80">
                  이메일
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="transition-all hover:border-border/80 focus-visible:ring-primary/20 focus-visible:border-primary/50 h-10 shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-medium text-foreground/80">
                    비밀번호
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="transition-all hover:border-border/80 focus-visible:ring-primary/20 focus-visible:border-primary/50 h-10 shadow-sm"
                />
              </div>
              {requiresCaptcha ? (
                <div className="pt-2">
                  <div className="relative mx-auto flex justify-center h-[65px] w-full max-w-[300px]">
                    {!isCaptchaLoaded && (
                      <Skeleton className="absolute inset-0 h-full w-full rounded-md" />
                    )}
                    <Turnstile
                      className={isCaptchaLoaded ? "" : "invisible"}
                      siteKey={siteKey || "1x00000000000000000000AA"}
                      onWidgetLoad={() => {
                        setIsCaptchaLoaded(true)
                      }}
                      onSuccess={(token) => {
                        setCaptchaToken(token)
                        setError("")
                      }}
                      onExpire={() => {
                        setCaptchaToken(null)
                      }}
                      onError={() => {
                        setCaptchaToken(null)
                      }}
                      options={{
                        theme: "light",
                        action: "admin_login",
                        refreshExpired: "auto",
                      }}
                    />
                  </div>
                </div>
              ) : import.meta.env.DEV ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Alert className="bg-primary/5 border-primary/10 text-primary/80">
                    <AlertDescription className="text-xs text-center font-medium">
                      개발 환경에서는 CAPTCHA 없이 로그인합니다.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              ) : (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                  <AlertDescription className="text-xs text-center font-medium">
                    CAPTCHA 구성이 필요합니다. 관리자에게 문의해주세요.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="pb-8">
              <Button
                type="submit"
                className="w-full h-10 font-medium transition-all active:scale-[0.98] shadow-sm relative overflow-hidden group"
                disabled={
                  isSubmitting || hasCaptchaConfigurationError || (requiresCaptcha && !captchaToken)
                }
              >
                <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  "로그인"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
