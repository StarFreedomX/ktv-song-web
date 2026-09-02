# --- 阶段 1: 构建 ---
FROM node:22-alpine AS builder

# 安装 pnpm（固定版本，与根 package.json 的 packageManager 保持一致）
RUN npm install -g pnpm@11.20.0

ARG NPM_CONFIG_REGISTRY

RUN if [ -n "${NPM_CONFIG_REGISTRY}" ]; then \
        npm config set registry ${NPM_CONFIG_REGISTRY} && \
        pnpm config set registry ${NPM_CONFIG_REGISTRY}; \
    fi

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json backend/pnpm-lock.yaml ./backend/

RUN pnpm install --frozen-lockfile --filter ./backend

COPY . .
RUN pnpm --filter ./backend build

# 运行缩小逻辑
RUN export PROJECT_ROOT=/app/backend/ && \
    node /app/backend/scripts/minify-docker.mjs && \
    rm -rf /app/backend/node_modules && \
    mv /app/backend/app-minimal/node_modules /app/backend/ && \
    rm -rf /app/backend/app-minimal

# --- 阶段 2: 运行 ---
FROM node:22-alpine AS runner
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    REDIS_URL=redis://redis:6379 \
    DEBUG_MODE=info \
    HOST=0.0.0.0

# 拷贝阶段 2 的产物
COPY --from=builder /app/backend ./

EXPOSE 5823
CMD ["node", "lib/index.js"]
