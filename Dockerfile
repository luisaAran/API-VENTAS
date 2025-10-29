FROM node:25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps build-base python3
RUN npm install -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install
COPY src ./src
COPY tsconfig.json ./
EXPOSE 3000
CMD ["pnpm", "run", "dev"]