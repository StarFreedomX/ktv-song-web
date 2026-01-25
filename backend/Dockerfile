# --- Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

RUN npm install

COPY . .

RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/lib ./lib
COPY --from=builder /app/static ./static
COPY --from=builder /app/package.json ./package.json

# 仅安装生产环境依赖
RUN npm install --omit=dev

EXPOSE 5823

# 使用 node 直接启动构建后的 js 文件
CMD ["node", "lib/index.js"]
