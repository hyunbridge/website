"use client"

import { ProtectedEmail } from "@/components/protected-email"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Github, Linkedin, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function ContactPageClient() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Get in touch</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent>
            <ProtectedEmail />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SocialMediaLink
              icon={<Github className="h-5 w-5" />}
              name="GitHub"
              url="https://github.com/hyunbridge"
            />

            <SocialMediaLink
              icon={<Linkedin className="h-5 w-5" />}
              name="LinkedIn"
              url="https://www.linkedin.com/in/hgseo"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SocialMediaLink({ icon, name, url }) {
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
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
          {url}
        </a>
        <Button onClick={copyToClipboard} variant="ghost" size="icon" className="h-6 w-6 p-0">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}
