"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  verifyTurnstile,
  checkEmailVerification,
} from "@/app/actions/verify-turnstile";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ProtectedEmail() {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if user is already verified when component mounts
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const token = localStorage.getItem("email-verification-token");
      if (!token) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const result = await checkEmailVerification(token);
      if (cancelled) return;

      if (result.success && result.verified) {
        setEmail(result.email || "");
      }
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle Turnstile verification
  const handleTurnstileVerification = async (token: string) => {
    setVerifying(true);
    setError(null);

    const formData = new FormData();
    formData.append("cf-turnstile-response", token);

    const result = await verifyTurnstile(formData);

    if (result.success) {
      localStorage.setItem("email-verification-token", result.token);
      setEmail(result.email || "");
    } else {
      setError(result.error || "Verification failed. Please try again.");
      toast({
        title: "Verification failed",
        description: result.error || "Please try again",
        variant: "destructive",
      });
    }

    setVerifying(false);
  };

  // Copy email to clipboard
  const copyToClipboard = () => {
    if (email) {
      navigator.clipboard.writeText(email);
      setCopied(true);
      toast({
        title: "Email copied",
        description: "Email address copied to clipboard",
      });

      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    );
  }

  if (email) {
    return (
      <div className="space-y-4">
        <div className="bg-muted p-4 rounded-md flex items-center justify-between min-h-[56px]">
          <p className="font-medium break-all">{email}</p>
          <div className="flex items-center gap-2">
            <Button
              onClick={copyToClipboard}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a href={`mailto:${email}`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
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
      ) : (
        <div className="flex justify-center w-full">
          <Turnstile
            siteKey={
              process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ||
              "1x00000000000000000000AA"
            }
            onSuccess={handleTurnstileVerification}
            options={{
              theme: "auto",
            }}
          />
        </div>
      )}
    </div>
  );
}
