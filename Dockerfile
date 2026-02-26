# Build stage
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Accept build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_S3_CDN_URL
ARG NEXT_PUBLIC_S3_BUCKET
ARG NEXT_PUBLIC_S3_REGION
ARG NEXT_PUBLIC_S3_ENDPOINT
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_GISCUS_REPO
ARG NEXT_PUBLIC_GISCUS_REPO_ID
ARG NEXT_PUBLIC_GISCUS_CATEGORY
ARG NEXT_PUBLIC_GISCUS_CATEGORY_ID
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BASE_URL

# Set environment variables for build time
ENV NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_S3_CDN_URL=$NEXT_PUBLIC_S3_CDN_URL
ENV NEXT_PUBLIC_S3_BUCKET=$NEXT_PUBLIC_S3_BUCKET
ENV NEXT_PUBLIC_S3_REGION=$NEXT_PUBLIC_S3_REGION
ENV NEXT_PUBLIC_S3_ENDPOINT=$NEXT_PUBLIC_S3_ENDPOINT
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_GISCUS_REPO=$NEXT_PUBLIC_GISCUS_REPO
ENV NEXT_PUBLIC_GISCUS_REPO_ID=$NEXT_PUBLIC_GISCUS_REPO_ID
ENV NEXT_PUBLIC_GISCUS_CATEGORY=$NEXT_PUBLIC_GISCUS_CATEGORY
ENV NEXT_PUBLIC_GISCUS_CATEGORY_ID=$NEXT_PUBLIC_GISCUS_CATEGORY_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

# Secrets required for Static Site Generation (Build time)
ARG NOTION_CV_PAGE_ID

ENV NOTION_CV_PAGE_ID=$NOTION_CV_PAGE_ID

COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build


# Run stage
FROM --platform=$TARGETPLATFORM node:22-alpine AS runner

WORKDIR /app

# Install Chromium and dependencies for Puppeteer with arch-specific options
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    dbus \
    fontconfig

# ARM-specific optimizations and Puppeteer settings
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Copy Next.js standalone output and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Install Pretendard into system font directory from public folder
RUN mkdir -p /usr/share/fonts/pretendard && \
    cp /app/public/fonts/*.otf /usr/share/fonts/pretendard/ && \
    fc-cache -fv

# Create necessary cache directories for Puppeteer
RUN mkdir -p /app/.cache/puppeteer && chown -R node:node /app

# Switch to non-root user for better security
USER node

EXPOSE 3000

CMD ["node", "server.js"]
