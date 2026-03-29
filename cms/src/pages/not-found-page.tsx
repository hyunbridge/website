"use client"

import Link from "@/components/ui/app-link"
import { Button } from "@shared/components/ui/button"
import { Home, SearchX } from "lucide-react"
import { StatePanel } from "@shared/components/ui/state-panel"

export default function NotFound() {
  return (
    <div className="container flex min-h-screen items-center justify-center">
      <StatePanel
        className="max-w-md"
        icon={<SearchX className="h-5 w-5" />}
        title="페이지를 찾을 수 없습니다"
        description="찾으시는 페이지가 없거나 이동되었습니다."
        detail="오류라고 생각되면 사이트 관리자에게 문의해주세요."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              대시보드로 돌아가기
            </Link>
          </Button>
        }
      />
    </div>
  )
}
