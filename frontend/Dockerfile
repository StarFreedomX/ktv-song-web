# --- 阶段一：构建 ---
FROM node:22-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter ./frontend build

# --- 阶段二：运行 ---
FROM node:22-slim AS runner
WORKDIR /app
RUN corepack enable

# 拷贝静态产物和启动脚本
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/start-frontend.cjs ./frontend/
COPY --from=builder /app/frontend/package.json ./frontend/
# 拷贝依赖配置
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# 只安装生产环境依赖 (express, http-proxy-middleware 等)
RUN pnpm install --prod --frozen-lockfile

# 环境变量设置
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# 前端监听端口
EXPOSE 5526

CMD ["node", "frontend/start-frontend.cjs"]
