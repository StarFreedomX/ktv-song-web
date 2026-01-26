# --- 阶段 1: 构建  ---
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter ./backend build
RUN pnpm --filter ./backend --prod deploy /prod/backend --legacy

# --- 阶段 2: 运行 ---
FROM node:20-alpine AS runner
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    REDIS_URL=redis://redis:6379 \
    DEBUG_MODE=info \
    HOST=0.0.0.0

# 拷贝产物
COPY --from=builder /prod/backend ./

EXPOSE 5823
CMD ["node", "lib/index.js"]
