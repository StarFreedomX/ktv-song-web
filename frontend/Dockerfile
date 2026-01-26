# --- 阶段 1: 构建 ---
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install && pnpm --filter ./frontend build

# --- 阶段 2: 运行 ---
FROM nginx:alpine-slim AS runner

# 拷贝静态产物
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# 拷贝模板
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 5526
ENV BACKEND_URL=http://ktv-web-backend:5823
