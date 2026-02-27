"use server";

// Verify Turnstile token for each request
export async function verifyTurnstileToken(token: string) {
  if (!token) {
    return { success: false, error: "No token provided" };
  }

  try {
    // Check for secret key
    if (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
      return { success: false, error: "Server configuration error" };
    }

    // Cloudflare Turnstile verification
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
    
    if (!data.success && data["error-codes"]) {
      return {
        success: false,
        verified: false,
        error: `Verification failed: ${data["error-codes"].join(", ")}`,
      };
    }
    
    return {
      success: data.success,
      verified: data.success,
      error: data.success ? null : "Token verification failed",
    };
  } catch {
    return {
      success: false,
      error: "Error occurred during verification",
    };
  }
}
