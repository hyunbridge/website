"use client"

import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Turnstile } from "@marsidev/react-turnstile"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DownloadButton({ className = "" }) {
  const [showVerification, setShowVerification] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY

  const handleDownload = () => {
    // Check if site key is configured
    if (!siteKey) {
      toast({
        title: "Configuration error",
        description: "Captcha verification is not properly configured",
        variant: "destructive",
      })
      return
    }
    
    // Always perform CAPTCHA verification
    setShowVerification(true)
  }

  const handleTurnstileVerification = async (token: string) => {
    setLoading(true)
    
    try {
      // Send token directly to the PDF API without client-side verification
      const pdfUrl = `/api/cv/pdf?token=${encodeURIComponent(token)}`
      
      // Close dialog before opening the PDF to avoid delays
      setShowVerification(false)
      
      // Open the PDF in a new tab
      window.open(pdfUrl, "_blank")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate the download. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleDownload} className={`print:hidden ${className}`} variant="outline">
        <FileDown className="mr-2 h-4 w-4" />
        Download PDF
      </Button>
      
      <Dialog open={showVerification} onOpenChange={setShowVerification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verification Required</DialogTitle>
            <DialogDescription>
              Please complete the CAPTCHA below to download the PDF.
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
                  refreshExpired: "auto"
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
