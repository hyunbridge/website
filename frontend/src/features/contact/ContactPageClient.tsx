"use client"

import { ProtectedEmail } from "@/components/protected-email"
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Copy, Check } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { useState } from "react"

export default function ContactPageClient() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">연락하기</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>이메일</CardTitle>
          </CardHeader>
          <CardContent>
            <ProtectedEmail />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>소셜 미디어</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SocialMediaLink
              icon={<GitHubMark className="h-5 w-5" />}
              name="GitHub"
              url="https://github.com/hyunbridge"
            />

            <SocialMediaLink
              icon={<LinkedInMark className="h-5 w-5" />}
              name="LinkedIn"
              url="https://www.linkedin.com/in/hgseo"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SocialMediaLink({
  icon,
  name,
  url,
}: {
  icon: React.ReactNode
  name: string
  url: string
}) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{name}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline truncate"
        >
          {url}
        </a>
        <Button onClick={copyToClipboard} variant="ghost" size="icon" className="h-6 w-6 p-0">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.72.08-.72 1.2.08 1.84 1.24 1.84 1.24 1.08 1.84 2.82 1.31 3.51 1 .11-.79.42-1.31.76-1.61-2.67-.31-5.48-1.34-5.48-5.95 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.55.12-3.23 0 0 1.01-.32 3.3 1.23a11.43 11.43 0 0 1 6 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.68.25 2.92.12 3.23.78.84 1.24 1.91 1.24 3.22 0 4.62-2.82 5.64-5.5 5.94.43.38.82 1.11.82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  )
}

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M4.98 3.5A1.48 1.48 0 1 1 5 6.46a1.48 1.48 0 0 1-.02-2.96ZM3.5 8h3V20h-3V8Zm5.5 0h2.88v1.64h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6V20h-3v-6.47c0-1.54-.03-3.53-2.15-3.53-2.16 0-2.49 1.68-2.49 3.42V20h-3V8Z" />
    </svg>
  )
}
