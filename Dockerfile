# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Accept build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_S3_CDN_URL
ARG NEXT_PUBLIC_S3_BUCKET
ARG NEXT_PUBLIC_S3_REGION
ARG NEXT_PUBLIC_S3_ENDPOINT
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL

# Set environment variables for build time
ENV NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_S3_CDN_URL=$NEXT_PUBLIC_S3_CDN_URL
ENV NEXT_PUBLIC_S3_BUCKET=$NEXT_PUBLIC_S3_BUCKET
ENV NEXT_PUBLIC_S3_REGION=$NEXT_PUBLIC_S3_REGION
ENV NEXT_PUBLIC_S3_ENDPOINT=$NEXT_PUBLIC_S3_ENDPOINT
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build


# Run stage
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime environment variables will be provided via docker run -e flags
ENV NODE_ENV=production

# Remove devDependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy necessary files for production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start"]
