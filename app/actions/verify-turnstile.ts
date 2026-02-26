"use server";

import jwt, { type JwtPayload } from "jsonwebtoken";

// Use environment variable for email address
const PROTECTED_EMAIL = process.env.PROTECTED_EMAIL;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

type VerifyTurnstileResult =
  | { success: true; token: string; email: string | undefined }
  | { success: false; error: string };

type CheckEmailVerificationResult =
  | { success: true; verified: boolean; email: string | undefined }
  | { success: false };

// Turnstile verification function
export async function verifyTurnstile(
  formData: FormData,
): Promise<VerifyTurnstileResult> {
  const token = formData.get("cf-turnstile-response") as string;

  if (!token) {
    return { success: false, error: "Missing token" };
  }
  if (!JWT_SECRET_KEY) {
    return { success: false, error: "Server configuration error" };
  }

  try {
    // Verify the token with Cloudflare
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
          response: token,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      // Generate a JWT with a 'verified' flag
      const token = jwt.sign({ verified: true }, JWT_SECRET_KEY, {
        expiresIn: "30m",
      });

      return {
        success: true,
        token,
        email: PROTECTED_EMAIL,
      };
    } else {
      return {
        success: false,
        error: "Verification failed",
      };
    }
  } catch (error) {
    console.error("Error verifying Turnstile:", error);
    return {
      success: false,
      error: "An error occurred during verification",
    };
  }
}

// Check if user is already verified
export async function checkEmailVerification(
  token: string,
): Promise<CheckEmailVerificationResult> {
  if (!JWT_SECRET_KEY) {
    return {
      success: false,
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    const verified =
      typeof decoded === "object" &&
      decoded !== null &&
      "verified" in decoded &&
      Boolean((decoded as JwtPayload & { verified?: unknown }).verified);
    return {
      success: true,
      verified,
      email: PROTECTED_EMAIL,
    };
  } catch (error) {
    return {
      success: false,
    };
  }
}
