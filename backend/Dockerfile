# --- 阶段 1: 构建 ---
FROM node:22-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json backend/pnpm-lock.yaml ./backend/

RUN pnpm install --frozen-lockfile --filter ./backend

COPY . .
RUN pnpm --filter ./backend build

RUN pnpm --filter ./backend --prod deploy /prod/backend

# --- 阶段 2: 运行 ---
FROM node:22-alpine AS runner
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    REDIS_URL=redis://redis:6379 \
    DEBUG_MODE=info \
    HOST=0.0.0.0

# 拷贝阶段 1 的产物
COPY --from=builder /prod/backend ./

EXPOSE 5823
CMD ["node", "lib/index.js"]
