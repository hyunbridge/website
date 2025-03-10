# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build


# Run stage
FROM node:22-alpine AS runner

WORKDIR /app

# Remove devDependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/.next .next

EXPOSE 3000

CMD ["npm", "run", "start"]
