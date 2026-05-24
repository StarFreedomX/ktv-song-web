# ktv-song-web

**KTV Song List Web**

前端支持自动解析 B 站分享字符串，并支持在「添加歌曲」里直接搜索 B 站 KTV 视频一键点歌。

## B站搜索 + Redis缓存

- 前端：`添加新歌曲` 弹窗内输入关键词，调用后端 `/api/bilibiliSearch` 获取候选；选择后会调用 `/api/bilibiliSearch/select` 记录点击热度用于排序。
- 后端：会对搜索结果做两层缓存
  - `bilibili_search_cache`：按关键词缓存搜索结果（默认 1 天）
  - `bilibili_search_catalog`：全局搜索目录（默认 14 天），用于做“局部匹配 + 热度排序”
- Redis：用于缓存歌曲列表、搜索结果、点击热度等。后端优先使用 Redis TTL（无需额外的“expireAt”逻辑）。

### 缓存作用域说明

- **房间级缓存**：歌曲列表缓存是按 `roomId` 隔离的，每个房间都有自己的 `ktv_room_<roomId>` 数据；一个房间的点歌、切歌、打乱不会影响另一个房间。
- **全局缓存**：B站搜索结果、搜索目录、点击热度都不按房间区分，所有房间共享同一份缓存数据，所以大家搜过的歌会一起提升命中率和排序效果。
- **内存缓存补充**：后端进程里还有一层按 `roomId` 分隔的内存缓存，用来减少 Redis 读取和重复计算，但最终持久化还是落在 Redis。

### TTL 和配置位置

- **房间级歌曲列表 TTL**：默认 `1 day`，对应 `CACHE_DATA_EXPIRE_TIME`。写入时由后端传给 Redis，代码位置在 `backend/src/ktvServer.ts`，真正写 Redis 的逻辑在 `backend/src/storage.ts`，会用 `PX` 方式设置过期时间。
- **房间级操作日志 TTL（内存）**：默认 `5 min`，对应 `CACHE_OP_EXPIRE_TIME`。它不是 Redis 缓存，而是进程内的 `roomOpCache`，通过定时清理控制失效。
- **全局搜索结果 TTL**：默认 `1 day`，对应 `SEARCH_CACHE_EXPIRE_TIME`。关键词搜索结果按归一化后的关键词存入 Redis，设置位置在 `/api/bilibiliSearch` 里。
- **全局搜索目录 TTL**：默认 `14 days`，对应 `SEARCH_CATALOG_EXPIRE_TIME`。搜索目录是全局共用的，设置位置在 `saveSearchCatalog()`。
- **全局点击热度 TTL**：默认 `365 days`，设置在 `/api/bilibiliSearch/select` 里。它用于给 B 站搜索结果排序，不按房间区分。

这些 TTL 的默认值都在 `backend/src/ktvServer.ts` 顶部定义，运行时会优先读取环境变量；Docker 开发调试时可以在 `docker-compose.yml` 里直接改对应的 `environment`。  
当前支持的时间格式包括：`ms`、`s`、`m`、`h`、`d`，例如 `5m`、`1h`、`24h`、`1d` 都可以直接写。

### normalize 是怎么做的

搜索时会先把关键词做 `normalizeSearchText`，规则很简单：

- 全部转成小写
- 去掉空格和大部分标点符号
- 去掉中英文括号、书名号、引号等包裹字符
- 保留中文、日文、英文和数字本身

这套规则会同时用于：

- 搜索缓存 key
- 搜索目录匹配
- 标题、标签、分P名字的局部匹配

举个例子，歌曲标题里如果出现：

`カラオケ字幕】【纯k投屏自用】StarDivine`

归一化后会变成：

`カラオケ字幕纯k投屏自用stardivine`

所以用户输入像 `Star Divine`、`star-divine`、`【纯k投屏自用】StarDivine` 这类写法时，后端会尽量把它们当成同一类搜索意图来处理，提高命中率。

### 图片缓存和代理

- **默认行为**：搜索结果默认返回 B 站 CDN 原始封面链接（`pic`），前端会优先直接加载这个地址，并使用 `referrerpolicy="no-referrer"`。
- **代理何时启用**：只有在启用 `ENABLE_BILIBILI_IMAGE_PROXY` 时，后端才会额外提供代理地址（`picProxy`，格式为 `/api/bilibiliImage?url=...`）。
- **前端回退逻辑**：前端默认先加载 `pic`；如果直连加载失败，才会回退到 `picProxy`（前提是后端已提供该字段）。
- **安全限制**：`/api/bilibiliImage` 只允许代理 `hdslb.com` 域名，防止任意外链图片被当成代理源。
- **图片缓存**：对于通过 `/api/bilibiliImage` 拉取的图片，后端会缓存在内存里的 `imageCache`，默认 TTL 是 `1 day`，对应 `IMAGE_CACHE_EXPIRE_TIME`。
- **浏览器缓存**：`/api/bilibiliImage` 响应还会设置 `Cache-Control: public, max-age=86400`，让浏览器也能复用这张图，减少重复请求。
- **配置位置**：图片缓存 TTL 的默认值在 `backend/src/ktvServer.ts` 顶部，Docker 环境可以在 `docker-compose.yml` 里通过 `IMAGE_CACHE_EXPIRE_TIME` 调整；是否给搜索结果附带 `picProxy` 则取决于 `ENABLE_BILIBILI_IMAGE_PROXY`。

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

如果你没有 `ghcr.io/starfreedomx` 的拉取权限，建议直接用下面这种方式部署：

```shell
docker compose up -d --build --pull never
```

这样 `backend` / `frontend` 会优先走本地 `Dockerfile` 构建，不会依赖原作者发布到 GHCR 的成品镜像；第一次构建时如果本地没有基础镜像，Docker 仍可能拉取像 `node`、`redis` 这类公共基础镜像。

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
        - CACHE_DATA_EXPIRE_TIME=24h
        # 内存中歌曲操作过期时间 默认 5 min
        - CACHE_OP_EXPIRE_TIME=5m
        # B站搜索缓存（关键词）过期时间 默认 1 day
        - SEARCH_CACHE_EXPIRE_TIME=24h
        # B站搜索目录缓存过期时间 默认 14 day
        - SEARCH_CATALOG_EXPIRE_TIME=14d
        # 图片代理缓存过期时间 默认 1 day
        - IMAGE_CACHE_EXPIRE_TIME=24h
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
