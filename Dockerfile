FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod ./
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=1 go build -trimpath \
    -ldflags="-s -w -X main.Version=${VERSION}" \
    -o /out/embermux ./cmd/embermux

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /out/embermux .
EXPOSE 8096
VOLUME ["/app/data", "/app/config"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8096/System/Info/Public >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "./embermux"]
