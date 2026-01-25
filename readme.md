# ktv-song-web

KTV Song List Web

前端支持自动解析b站分享字符串

## 启动方式

### 使用 Docker Compose 启动

如果你安装了 Docker 和 Docker Compose

可以使用docker直接启动

首先在创建一个目录，并创建`docker-compose.yml`

将下面的yml复制进`docker-compose.yml`中

```yml
# docker-compose.yml
services:
    # 后端服务
    ktv-web-backend:
        image: ghcr.io/starfreedomx/ktv-song-web-backend:latest
        container_name: ktv-web-backend
        restart: always
        depends_on:
            - redis

    # 前端服务
    ktv-web-frontend:
        image: ghcr.io/starfreedomx/ktv-song-web-frontend:latest
        container_name: ktv-web-frontend
        restart: always
        ports:
            - "5526:5526"
        depends_on:
            - ktv-web-backend

    # Redis 数据库
    redis:
        image: redis:alpine
        container_name: ktv-web-redis
        restart: always
        command: redis-server --appendonly yes
        volumes:
            - redis_data:/data

volumes:
    redis_data:
```

启动

```shell
docker compose up -d
# 如果使用旧版docker compose (v1),则使用docker-compose up -d
```

#### 默认配置

```yaml
ktv-web-backend:
    # ......
    environment:
        # 监听端口
        - PORT=5823
        # 监听HOST
        # Docker环境默认值为0.0.0.0
        # 其他环境默认值为localhost
        - HOST=0.0.0.0
        # 日志模式
        - DEBUG_MODE=info
        # REDIS数据库地址
        # Docker环境默认值为redis://redis:6379
        # 其他环境默认值为redis://localhost:6379
        - REDIS_URL=redis://redis:6379
        # 数据库歌曲缓存过期时间 默认 1 day
        - CACHE_DATA_EXPIRE_TIME=86400000
        # 内存中歌曲操作过期时间 默认 5 min
        - CACHE_OP_EXPIRE_TIME=300000
ktv-web-frontend:
    # ......
    environment:
        # 后端地址
        # Docker环境默认值为http://ktv-web-backend:5823
        # 其他环境默认值为http://localhost:5823
        - BACKEND_URL=http://ktv-web-backend:5823
```

### GitHub Release包启动

1. 前往[Release](https://github.com/StarFreedomX/ktv-song-web/releases)页面下载构建好的包
2. 解压，进入解压后的目录
3. 执行`pnpm install`
4. 运行`pnpm start`

### 本地构建启动

```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git

cd ktv-song-web

# 如果没有安装pnpm，运行下面这行
# npm install -g pnpm

pnpm install

pnpm build

# 接下来可以进入frontend backend文件夹
# 复制一份 .env 到 .env.local
# 然后在 .env.local 中修改你想修改的配置

# 启动
pnpm start
```

默认环境见上方 [默认配置](#默认配置)

### 开发模式启动
```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git
cd ktv-song-web
pnpm install
pnpm dev
```

默认环境见上方 [默认配置](#默认配置)

### 单独启动

本项目支持单独启动前端和后端

相关启动方式可以参考对应文件夹的`package.json`文件

应用将运行在 `http://localhost:5823`。
