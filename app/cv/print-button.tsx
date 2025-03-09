"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <Button onClick={handlePrint} className="print:hidden" variant="outline">
      <Printer className="mr-2 h-4 w-4" />
      Print CV
    </Button>
  )
}

