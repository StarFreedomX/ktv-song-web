# --- 构建阶段 ---
FROM node:22-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
# 拷贝整个工作区的依赖配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

# 拷贝源码并构建后端
COPY . .
RUN pnpm --filter ./backend build

# --- 运行阶段 ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# 拷贝构建产物和生产依赖所需文件
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/lib ./backend/lib

# 安装生产环境依赖
RUN corepack enable && pnpm install --prod --frozen-lockfile

EXPOSE 5823
CMD ["node", "backend/lib/index.js"]
