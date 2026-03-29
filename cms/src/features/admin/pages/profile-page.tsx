"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, Upload } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { uploadToS3 } from "@/lib/s3-service"
import { request } from "@/lib/api-client"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@shared/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card"
import { Input } from "@shared/components/ui/input"
import { Label } from "@shared/components/ui/label"
import { Skeleton } from "@shared/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ProfileResponse = {
  username: string
  full_name: string | null
  avatar_url: string | null
  email: string
  git_author_name: string | null
  git_author_email: string | null
}

export default function AdminProfilePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fullName, setFullName] = useState("")
  const [gitAuthorName, setGitAuthorName] = useState("")
  const [gitAuthorEmail, setGitAuthorEmail] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (!user) {
        if (mounted) setIsLoading(false)
        return
      }

      try {
        const nextProfile = await request<ProfileResponse>("/admin/profile", { auth: true })
        if (!mounted) return
        setProfile(nextProfile)
        setFullName(nextProfile.full_name || "")
        setGitAuthorName(nextProfile.git_author_name || "")
        setGitAuthorEmail(nextProfile.git_author_email || "")
      } catch (nextError) {
        if (!mounted) return
        setError(nextError instanceof Error ? nextError.message : "프로필을 불러오지 못했습니다.")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [user])

  async function uploadAvatar() {
    if (!avatarFile || !user) return profile?.avatar_url || null
    return uploadToS3(avatarFile, { resourceType: "avatar", resourceID: user.id })
  }

  async function handleSaveProfile() {
    setIsSavingProfile(true)
    setMessage(null)
    setError(null)

    try {
      const avatarURL = avatarFile ? await uploadAvatar() : profile?.avatar_url || null
      const nextProfile = await request<ProfileResponse>("/admin/profile", {
        method: "PATCH",
        auth: true,
        body: {
          full_name: fullName || null,
          avatar_url: avatarURL,
          git_author_name: gitAuthorName || null,
          git_author_email: gitAuthorEmail || null,
        },
      })
      setProfile(nextProfile)
      setAvatarFile(null)
      setAvatarPreview(null)
      setMessage("프로필을 성공적으로 업데이트했습니다.")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "프로필을 업데이트하지 못했습니다.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (currentPassword.length < 8) {
      setError("현재 비밀번호를 입력해주세요.")
      return
    }
    if (newPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }

    setIsSavingPassword(true)
    setMessage(null)
    setError(null)

    try {
      await request("/admin/profile/password", {
        method: "POST",
        auth: true,
        body: { current_password: currentPassword, password: newPassword },
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setMessage("비밀번호를 성공적으로 변경했습니다.")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "비밀번호를 변경하지 못했습니다.")
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      </div>
    )
  }

  if (!profile) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "프로필을 불러오지 못했습니다."}</AlertDescription>
      </Alert>
    )
  }

  const avatarSource = avatarPreview || profile.avatar_url || undefined
  const avatarFallback = (profile.full_name || profile.username || "A").slice(0, 1).toUpperCase()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">프로필</h1>

      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">프로필</TabsTrigger>
          <TabsTrigger value="password">비밀번호</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>프로필 정보</CardTitle>
              <CardDescription>관리자 계정과 버전 기록에 표시될 정보를 수정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarSource} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>

                <div className="space-y-2">
                  <Label htmlFor="avatar">아바타 이미지</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null
                        setAvatarFile(file)
                        setAvatarPreview(file ? URL.createObjectURL(file) : null)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("avatar")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      선택
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" value={profile.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">사용자명</Label>
                  <Input id="username" value={profile.username} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full-name">이름</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="git-author-name">버전 기록 이름</Label>
                  <Input
                    id="git-author-name"
                    value={gitAuthorName}
                    onChange={(event) => setGitAuthorName(event.target.value)}
                    placeholder="예: 홍길동"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="git-author-email">버전 기록 이메일</Label>
                  <Input
                    id="git-author-email"
                    type="email"
                    value={gitAuthorEmail}
                    onChange={(event) => setGitAuthorEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>관리자 로그인에 사용할 비밀번호를 변경합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">현재 비밀번호</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">새 비밀번호</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleChangePassword} disabled={isSavingPassword}>
                {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                비밀번호 변경
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
