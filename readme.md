# ktv-song-web

KTV Song List Web

前端支持自动解析b站分享字符串

使用方法(确保安装了yarn/npm/pnpm等和Node.js)

注: 需要先启动redis服务，否则数据无法持久化

## 启动方式

### 使用 Docker Compose 启动

如果你安装了 Docker 和 Docker Compose

可以使用docker直接启动

首先在创建一个目录，并创建`docker-compose.yml`

将下面的yml复制进`docker-compose.yml`中

```yml
# docker-compose.yml
services:
  ktv-server:
    image: starfreedomx/ktv-song-web:latest
    container_name: k-mlw-worker-1
    ports:
      - "5823:5823"
    environment:
      - PORT=5823
      - HOST=0.0.0.0
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - redis
    restart: always

  redis:
    image: redis:alpine
    container_name: k-mlw-redis-1
    # 为了防止已有redis服务的影响，不向外暴露端口
    # 如果需要在主机访问这个redis，把下面的注释删除
    # ports:
    #  - "6379:6379"
    volumes:
      - ktv_redis_data:/data
    restart: always

volumes:
  ktv_redis_data:
```

启动

```shell
docker compose up -d
# 如果使用旧版docker compose (v1),则使用docker-compose up -d
```

### 本地构建启动

```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git

cd ktv-song-web

yarn install
# npm install
# pnpm install

yarn build
# npm run build
# pnpm build

# 复制一份 .env.example 到 .env
# 然后在 .env 中修改你想修改的配置

# 启动
yarn start
# npm run start
# pnpm start
```

### TS模式启动
```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git
cd ktv-song-web
yarn install # 或npm/pnpm等
yarn start-ts # 或npm/pnpm等
```

### 开发模式启动
```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git
cd ktv-song-web
yarn install # 或npm/pnpm等
yarn dev # 或npm/pnpm等
# 如果需要监听文件变化，使用这个
# yarn dev-watch # 或npm/pnpm等
```

应用将运行在 `http://localhost:5823`。
