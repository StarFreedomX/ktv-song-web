# --- 阶段 1: 构建 ---
FROM node:22-alpine AS builder

# 强制使用镜像源，避免构建时走默认 npm registry
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com \
    PNPM_HOME=/root/.local/share/pnpm

# 安装 pnpm
RUN npm install -g pnpm
RUN npm config set registry ${NPM_CONFIG_REGISTRY} && \
    pnpm config set registry ${NPM_CONFIG_REGISTRY}

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/

RUN pnpm install --frozen-lockfile --filter ./frontend

COPY . .
RUN pnpm --filter ./frontend build

# --- 阶段 2: 运行 ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com \
    NODE_ENV=production \
    BACKEND_URL=http://ktv-web-backend:5823 \
    HOST=0.0.0.0 \
    PORT=5526

COPY --from=builder /app/frontend/dist ./dist
COPY --from=builder /app/frontend/start-frontend.cjs ./start-frontend.cjs
COPY --from=builder /app/frontend/package.json ./package.json
COPY --from=builder /app/frontend/node_modules ./node_modules

EXPOSE 5526
CMD ["node", "start-frontend.cjs"]
