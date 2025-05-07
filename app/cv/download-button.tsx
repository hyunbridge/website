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
  const [generatingPdf, setGeneratingPdf] = useState(false)
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
      // Close CAPTCHA dialog and show PDF generation process
      setShowVerification(false)
      setGeneratingPdf(true)
      
      // Send token to the PDF API
      const pdfUrl = `/api/cv/pdf?token=${encodeURIComponent(token)}`
      
      // Fetch the PDF as blob instead of opening a new window
      const response = await fetch(pdfUrl)
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }
      
      // Convert response to blob
      const blob = await response.blob()
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = "CV.pdf"
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      // Clean up the URL object
      window.URL.revokeObjectURL(downloadUrl)
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate or download the PDF. Please try again.",
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
      
      {/* PDF Generation Dialog */}
      <Dialog open={generatingPdf} onOpenChange={setGeneratingPdf}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF Download</DialogTitle>
            <DialogDescription>
              Please wait while we generate your PDF.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Generating PDF...</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
