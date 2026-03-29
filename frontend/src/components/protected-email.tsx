"use client"

import { buildApiUrl } from "@/lib/api-client"
import { useState, useEffect, useRef } from "react"
import { Button } from "@shared/components/ui/button"
import { Skeleton } from "@shared/components/ui/skeleton"
import { Copy, Check, ExternalLink, AlertCircle } from "lucide-react"
import { Turnstile } from "@marsidev/react-turnstile"
import { useToast } from "@shared/hooks/use-toast"
import { Alert, AlertDescription } from "@shared/components/ui/alert"

export function ProtectedEmail() {
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoVerifyStartedRef = useRef(false)
  const { toast } = useToast()
  const siteKey = import.meta.env.PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
  const requiresCaptcha = Boolean(siteKey)
  const hasCaptchaConfigurationError = import.meta.env.PROD && !requiresCaptcha

  // Check if user is already verified when component mounts
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const token = localStorage.getItem("email-verification-token")
      if (!token) {
        if (!cancelled) {
          setLoading(false)
        }
        return
      }

      try {
        const response = await fetch(buildApiUrl("/contact/email-status", { token }), {
          cache: "no-store",
        })
        const result = response.ok ? await response.json() : { success: false }
        if (cancelled) return

        if (result.success && result.verified) {
          setEmail(result.email || "")
        }
      } catch {
        if (cancelled) return
      }

      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading || email || verifying || error || hasCaptchaConfigurationError || requiresCaptcha) {
      return
    }
    if (autoVerifyStartedRef.current) {
      return
    }
    autoVerifyStartedRef.current = true
    void handleTurnstileVerification("")
  }, [email, error, hasCaptchaConfigurationError, loading, requiresCaptcha, verifying])

  // Handle Turnstile verification
  const handleTurnstileVerification = async (token: string) => {
    setVerifying(true)
    setError(null)
    try {
      const response = await fetch(buildApiUrl("/contact/verify-turnstile"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })
      const result = await response.json()

      if (result.success) {
        localStorage.setItem("email-verification-token", result.token)
        setEmail(result.email || "")
        return
      }

      setError(result.error || "인증에 실패했습니다. 다시 시도해주세요.")
      toast({
        title: "인증 실패",
        description: result.error || "다시 시도해주세요.",
        variant: "destructive",
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : "인증에 실패했습니다. 다시 시도해주세요.")
      toast({
        title: "인증 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setVerifying(false)
    }
  }

  // Copy email to clipboard
  const copyToClipboard = () => {
    if (email) {
      navigator.clipboard.writeText(email)
      setCopied(true)
      toast({
        title: "이메일 복사 완료",
        description: "이메일 주소를 클립보드에 복사했습니다.",
      })

      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 w-full">
        <div className="bg-muted p-4 rounded-md min-h-[56px] flex items-center justify-between">
          <Skeleton className="h-[24px] w-3/4 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md animate-pulse" />
            <Skeleton className="h-8 w-8 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (email) {
    return (
      <div className="space-y-4">
        <div className="bg-muted p-4 rounded-md flex items-center justify-between min-h-[56px]">
          <p className="font-medium break-all">{email}</p>
          <div className="flex items-center gap-2">
            <Button onClick={copyToClipboard} variant="ghost" size="icon" className="h-8 w-8">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a href={`mailto:${email}`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {hasCaptchaConfigurationError && (
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertDescription>
            이메일 보호 구성이 올바르지 않습니다. 잠시 후 다시 시도해주세요.
          </AlertDescription>
        </Alert>
      )}

      {verifying ? (
        <div className="space-y-4 w-full">
          <div className="bg-muted p-4 rounded-md min-h-[56px] flex items-center justify-between">
            <Skeleton className="h-[24px] w-3/4 animate-pulse" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md animate-pulse" />
              <Skeleton className="h-8 w-8 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      ) : hasCaptchaConfigurationError ? null : error ? (
        <div className="bg-muted text-destructive p-4 rounded-md min-h-[56px] flex items-center gap-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm leading-6">{error}</p>
        </div>
      ) : (
        <div className="flex justify-center w-full min-h-[56px] items-center">
          {requiresCaptcha ? (
            <Turnstile
              siteKey={siteKey || "1x00000000000000000000AA"}
              onSuccess={handleTurnstileVerification}
              options={{
                theme: "auto",
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
