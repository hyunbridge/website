FROM --platform=$BUILDPLATFORM golang:1.25-trixie AS builder

WORKDIR /src

ARG TARGETOS
ARG TARGETARCH

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-$(go env GOARCH)} \
	go build -trimpath -ldflags="-s -w" -o /out/website-api ./cmd/api

FROM gcr.io/distroless/static-debian13:nonroot

WORKDIR /app

ENV HTTP_ADDR=:8080

COPY --from=builder --chown=65532:65532 /out/website-api /app/website-api

EXPOSE 8080

ENTRYPOINT ["/app/website-api"]
