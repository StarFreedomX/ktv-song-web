# ktv-song-web

**KTV Song List Web**

前端支持自动解析 B 站分享字符串，并支持在「添加歌曲」里直接搜索 B 站 KTV 视频一键点歌。

## B站搜索 + Redis缓存

- 前端：`添加新歌曲` 弹窗内输入关键词，调用后端 `/api/bilibiliSearch` 获取候选；选择后会调用 `/api/bilibiliSearch/select` 记录点击热度用于排序。
- 后端：会对搜索结果做两层缓存
  - `bilibili_search_cache`：按关键词缓存搜索结果（默认 1 天）
  - `bilibili_search_catalog`：全局搜索目录（默认 14 天），用于做“局部匹配 + 热度排序”
- Redis：用于缓存歌曲列表、搜索结果、点击热度等。后端优先使用 Redis TTL（无需额外的“expireAt”逻辑）。

## 投屏功能

1. 利用云视听小电视投屏

    通常需要设备开启分屏模式

    通过开启**主机模式(`HostMode`)**及**App跳转**，客户端会自动追踪当前在唱歌曲

    检测到歌曲更改后会自动打开bilibili

    若同时在**bilibili主页**中连接了投屏设备

    则会自动播放并投屏bilibili视频

2. 利用投屏后端使用DLNA协议投屏

    投屏后端详见[ktv-casting](https://github.com/aspromise/ktv-casting)

    投屏后端将追踪当前在唱歌曲，并且可以歌曲结束自动切换下一首

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

### 使用 Docker Compose 开发调试（不在宿主机安装依赖）

项目的 `backend/Dockerfile` 与 `frontend/Dockerfile` 会在镜像构建阶段安装依赖并打包，因此你可以直接用 Docker 进行调试与验证，而无需在宿主机执行 `npm install` / `pnpm install` 产生 `node_modules`。

```shell
# 构建并启动（会重新 build 两个镜像）
docker compose up -d --build --force-recreate --remove-orphans

# 查看日志
docker compose logs -f ktv-web-backend
docker compose logs -f ktv-web-frontend
```

访问：`http://localhost:5526/?roomId=demo`

如果你想直接调后端接口，也可以访问：`http://localhost:5823/api/songListInfo?roomId=demo`

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
        # 日志模式 详细程度: error < warn < info < debug < trace
        - DEBUG_MODE=info
        # REDIS数据库地址
        # Docker环境默认值为redis://redis:6379
        # 其他环境默认值为redis://localhost:6379
        - REDIS_URL=redis://redis:6379
        # 数据库歌曲缓存过期时间 默认 1 day
        - CACHE_DATA_EXPIRE_TIME=86400000
        # 内存中歌曲操作过期时间 默认 5 min
        - CACHE_OP_EXPIRE_TIME=300000
        # B站搜索缓存（关键词）过期时间 默认 1 day
        - SEARCH_CACHE_EXPIRE_TIME=86400000
        # B站搜索目录缓存过期时间 默认 14 day
        - SEARCH_CATALOG_EXPIRE_TIME=1209600000
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
3. 执行`pnpm install --prod`
    > 可以使用`--frozen-lockfile`来锁定依赖版本
4. 运行`pnpm start`

### 本地构建启动

```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git

cd ktv-song-web

# 如果没有安装pnpm，运行下面这行
# npm install -g pnpm

pnpm install # 可以使用`--frozen-lockfile`来锁定依赖版本

pnpm build

# 清理开发依赖
pnpm i --prod

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
pnpm install # 可以使用`--frozen-lockfile`来锁定依赖版本
pnpm dev
```

默认环境见上方 [默认配置](#默认配置)

### 单独启动

本项目支持单独启动前端和后端

相关启动方式可以参考对应文件夹的`package.json`文件

应用将运行在 `http://localhost:5823`。
