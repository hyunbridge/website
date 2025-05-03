"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Upload, Check, X } from "lucide-react"
import { getPresignedUrl, uploadToS3 } from "@/lib/s3-service"

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<{
    username: string
    full_name: string | null
    avatar_url: string | null
  } | null>(null)
  const [fullName, setFullName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", user.id)
          .single()

        if (error) {
          throw error
        }

        setProfile(data)
        setFullName(data.full_name || "")
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchProfile()
    }
  }, [user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null

    setIsUploadingAvatar(true)
    try {
      const fileName = `avatars/${user.id}/${Date.now()}-${avatarFile.name}`
      const contentType = avatarFile.type

      // Get presigned URL
      const presignedUrl = await getPresignedUrl(fileName, contentType)

      // Upload to S3
      await uploadToS3(presignedUrl, avatarFile, contentType)

      // Construct the CDN URL
      const cdnUrl = `${process.env.NEXT_PUBLIC_S3_CDN_URL}/${fileName}`

      return cdnUrl
    } catch (error) {
      console.error("Error uploading avatar:", error)
      throw error
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const updateProfile = async () => {
    if (!user) return

    setIsUpdatingProfile(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      let avatarUrl = profile?.avatar_url

      // Upload avatar if changed
      if (avatarFile) {
        avatarUrl = await uploadAvatar()
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          username: user.email,
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) {
        throw error
      }

      setProfile({
        ...profile!,
        username: user.email || "",
        full_name: fullName,
        avatar_url: avatarUrl || null,
      })

      setSuccessMessage("Profile updated successfully")
    } catch (error: any) {
      console.error("Error updating profile:", error)
      setErrorMessage(error.message || "Failed to update profile")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const changePassword = async () => {
    if (!user) return

    setIsChangingPassword(true)
    setSuccessMessage("")
    setErrorMessage("")

    try {
      if (newPassword !== confirmPassword) {
        setErrorMessage("Passwords do not match")
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw error
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccessMessage("Password changed successfully")
    } catch (error: any) {
      console.error("Error changing password:", error)
      setErrorMessage(error.message || "Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {(successMessage || errorMessage) && (
            <Alert variant={successMessage ? "default" : "destructive"}>
              <AlertDescription>{successMessage || errorMessage}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Update your profile picture</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={avatarPreview || profile?.avatar_url || undefined}
                  alt={user.email || "Avatar"}
                />
                <AvatarFallback>
                  {user.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center">
                <Label
                  htmlFor="avatar"
                  className="cursor-pointer bg-muted hover:bg-muted/80 px-4 py-2 rounded-md flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose Image
                </Label>
                <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Username)</Label>
                <Input id="email" type="email" value={user.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={updateProfile}
                disabled={isUpdatingProfile || isUploadingAvatar}
              >
                {isUpdatingProfile || isUploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {(successMessage || errorMessage) && (
            <Alert variant={successMessage ? "default" : "destructive"}>
              <AlertDescription>{successMessage || errorMessage}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={
                    confirmPassword && newPassword !== confirmPassword
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={changePassword}
                disabled={isChangingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
