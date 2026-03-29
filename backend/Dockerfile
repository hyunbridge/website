# Stage 1: Builder
FROM --platform=$BUILDPLATFORM golang:1.24-bookworm AS builder

WORKDIR /src

ARG TARGETOS
ARG TARGETARCH

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-$(go env GOARCH)} \
	go build -trimpath -ldflags="-s -w" -o /out/website-api ./cmd/api


# Stage 2: Prepare writable runtime paths for the non-root distroless user
FROM debian:trixie-slim AS runtime-prep

RUN mkdir -p /app/data && chown -R 65532:65532 /app


# Stage 3: Runtime - Distroless
FROM gcr.io/distroless/static-debian13:nonroot

WORKDIR /app

ENV HTTP_ADDR=:8080

COPY --from=runtime-prep --chown=65532:65532 /app/data /app/data
COPY --from=builder --chown=65532:65532 /out/website-api /app/website-api

EXPOSE 8080

ENTRYPOINT ["/app/website-api"]
