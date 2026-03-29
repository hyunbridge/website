"use client"

import { buildApiUrl } from "@/lib/api-client"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { useState } from "react"
import { Turnstile } from "@marsidev/react-turnstile"
import { useToast } from "@shared/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"
import { downloadFileFromResponse } from "@/lib/download"

export function DownloadButton({ className = "" }) {
  const [showVerification, setShowVerification] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const { toast } = useToast()

  const siteKey = import.meta.env.PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
  const requiresCaptcha = Boolean(siteKey)
  const hasCaptchaConfigurationError = import.meta.env.PROD && !requiresCaptcha

  const handleDownload = () => {
    if (hasCaptchaConfigurationError) {
      toast({
        title: "오류",
        description: "PDF 다운로드 구성이 올바르지 않습니다. 관리자에게 문의해주세요.",
        variant: "destructive",
      })
      return
    }
    if (!requiresCaptcha) {
      void handleTurnstileVerification("")
      return
    }
    setShowVerification(true)
  }

  const handleTurnstileVerification = async (token: string) => {
    setLoading(true)

    try {
      // Close CAPTCHA dialog and show PDF generation process
      setShowVerification(false)
      setGeneratingPdf(true)

      const pdfUrl = buildApiUrl("/cv/pdf", { token })

      const response = await fetch(pdfUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `Error: ${response.status}`)
      }

      await downloadFileFromResponse(response, "CV.pdf")

      toast({
        title: "다운로드 시작",
        description: "PDF 다운로드를 시작했습니다.",
      })
    } catch {
      toast({
        title: "오류",
        description: "PDF를 생성하거나 다운로드하지 못했습니다. 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setGeneratingPdf(false)
    }
  }

  return (
    <>
      <Button onClick={handleDownload} className={`print:hidden ${className}`} variant="outline">
        <FileDown className="mr-2 h-4 w-4" />
        PDF 다운로드
      </Button>

      <Dialog open={showVerification} onOpenChange={setShowVerification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>확인이 필요합니다</DialogTitle>
            <DialogDescription>
              PDF를 다운로드하려면 아래 CAPTCHA 인증을 완료해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Turnstile
                siteKey={siteKey || "1x00000000000000000000AA"}
                onSuccess={handleTurnstileVerification}
                options={{
                  theme: "auto",
                  action: "pdf_download",
                  refreshExpired: "auto",
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Generation Dialog */}
      <Dialog open={generatingPdf} onOpenChange={setGeneratingPdf}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF 다운로드</DialogTitle>
            <DialogDescription>PDF를 준비하는 동안 잠시만 기다려주세요.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>PDF를 준비하고 있습니다...</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
