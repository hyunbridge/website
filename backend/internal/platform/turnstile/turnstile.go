package turnstile

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type verificationResponse struct {
	Success bool     `json:"success"`
	Error   []string `json:"error-codes"`
}

var turnstileHTTPClient = &http.Client{Timeout: 10 * time.Second}

func Verify(secret, token string) error {
	if secret == "" {
		return fmt.Errorf("turnstile secret is not configured")
	}
	if token == "" {
		return fmt.Errorf("turnstile token is required")
	}

	values := url.Values{}
	values.Set("secret", secret)
	values.Set("response", token)

	resp, err := turnstileHTTPClient.Post(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		"application/x-www-form-urlencoded",
		strings.NewReader(values.Encode()),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var payload verificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}

	if !payload.Success {
		if len(payload.Error) == 0 {
			return fmt.Errorf("turnstile verification failed")
		}
		return fmt.Errorf("turnstile verification failed: %s", strings.Join(payload.Error, ", "))
	}

	return nil
}
