package gotenberg

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/config"
)

var gotenbergHTTPClient = &http.Client{Timeout: 60 * time.Second}

func ConvertURLToPDF(cfg config.Config, targetURL string) ([]byte, error) {
	if cfg.GotenbergURL == "" {
		return nil, fmt.Errorf("gotenberg url is not configured")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("url", targetURL)
	_ = writer.WriteField("printBackground", "true")
	_ = writer.WriteField("preferCssPageSize", "true")
	_ = writer.WriteField("waitForSelector", "[data-cv-print-ready='true']")
	if err := writer.Close(); err != nil {
		return nil, err
	}

	endpoint := strings.TrimSuffix(cfg.GotenbergURL, "/") + "/forms/chromium/convert/url"
	req, err := http.NewRequest(http.MethodPost, endpoint, &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if cfg.GotenbergUsername != "" && cfg.GotenbergPassword != "" {
		creds := base64.StdEncoding.EncodeToString([]byte(cfg.GotenbergUsername + ":" + cfg.GotenbergPassword))
		req.Header.Set("Authorization", "Basic "+creds)
	}

	resp, err := gotenbergHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("gotenberg request failed with status %d: %s", resp.StatusCode, string(payload))
	}

	return io.ReadAll(resp.Body)
}
