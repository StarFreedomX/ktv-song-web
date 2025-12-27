# ktv-song-web

KTV Song List Web

前端支持自动解析b站分享字符串

使用方法(确保安装了yarn/npm/pnpm等和Node.js)

注: 需要先启动redis服务，否则数据无法持久化

```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git

cd ktv-song-web

yarn install
# npm install
# pnpm install

# 复制一份 .env.example 到 .env
# 然后在 .env 中修改你想修改的配置

# 启动
yarn start
# npm run start
# pnpm start
```

### 使用 Docker Compose 启动

如果你安装了 Docker 和 Docker Compose，可以使用以下命令一键启动：

```shell
docker compose up -d
#如果使用旧版docker compose (v1),则使用docker-compose up -d
```

这会自动启动 Node.js 应用和 Redis 服务。应用将运行在 `http://localhost:5823`。
