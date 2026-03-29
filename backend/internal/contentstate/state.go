package contentstate

import (
	"encoding/json"
	"strings"
)

type HomePublishState struct {
	Status             string  `json:"status"`
	PublishedVersionID *string `json:"publishedVersionId"`
	PublishedAt        *string `json:"publishedAt"`
}

func BuildHomePublishState(state HomePublishState) ([]byte, error) {
	return json.MarshalIndent(normalizeHomePublishState(state), "", "  ")
}

func ParseHomePublishState(payload []byte) (HomePublishState, error) {
	var state HomePublishState
	if err := json.Unmarshal(payload, &state); err != nil {
		return HomePublishState{}, err
	}
	return normalizeHomePublishState(state), nil
}

func normalizeHomePublishState(state HomePublishState) HomePublishState {
	state.Status = strings.TrimSpace(state.Status)
	if state.Status == "" {
		state.Status = "draft"
	}
	state.PublishedVersionID = trimOptionalString(state.PublishedVersionID)
	state.PublishedAt = trimOptionalString(state.PublishedAt)
	return state
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
