# 开发与部署文档

本文面向开发者及需要调整服务配置的部署者，包含接口、缓存、环境变量、构建和调试说明。日常使用、预构建镜像部署及通过 Git 更新源码部署请参阅 [使用指南](readme.md)。

## 歌单同步

WebSocket 每 20 秒发送一次 ping，10 秒内未收到 pong 时关闭旧连接，并在 3 秒后重连；重连成功后补拉歌单。断线、切换同步模式和退出房间时清理心跳及超时定时器，旧连接的回调不会影响新连接。

## B站搜索 + Redis缓存

- 前端：`添加新歌曲` 弹窗内输入关键词，调用后端 `/api/bilibiliSearch` 获取候选；选择后会调用 `/api/bilibiliSearch/select` 记录点击热度用于排序。
- 伴奏提示：后端会保留 B 站搜索接口返回的原始 `tag`，并结合现有标题标签、视频标题、分P标题做“仅伴奏 / off vocal”识别；当前分P优先级最高，标题里明确含 `on vocal` 时会压过 `off vocal` 提示。前端默认会在点歌前弹出确认提示，用户也可以在设置里关闭；搜索弹窗里双击标题可直接打开 B 站确认。
- 后端：会对搜索结果做两层缓存
  - `bilibili_search_cache`：按关键词缓存搜索结果（默认 1 天）
  - `bilibili_search_catalog`：全局搜索目录（默认 14 天），用于做“局部匹配 + 热度排序”
- Redis：用于缓存歌曲列表、搜索结果、点击热度等。后端优先使用 Redis TTL（无需额外的“expireAt”逻辑）。

### request-id机制

后端的POST操作支持传入请求头`request-id`，包含该请求头时，短时间内相同rid的请求只会被触发一次，适合防止连续切歌

rid建议使用标准36位uuid，防止碰撞。rid上限40字符，并且需要为字符串。

### 添加歌曲

`POST /api/addSong?roomId=...`，请求体包含 `song`，字段为 `id`、`title`、`url` 和可选的 `addedBy`，不需要 Hash 或位置。歌曲校验和链接解析与旧接口一致，追加到当前队尾，并记录操作日志、持久化和广播更新。成功返回 `success: true`、`hash` 和解析后的 `song`。两个接口使用独立处理函数；`/api/songOperation` 保留旧客户端的添加、移动、编辑、删除行为，后端先更新、前端尚未更新时仍可正常使用。

前端添加窗口内，相同提交内容复用 `request-id` 和歌曲 ID；修改内容或关闭后重新打开会生成新标识，不自动重试。收藏和历史记录再次点歌也使用新接口。rid 中间件保持原行为及默认 1 分钟 TTL，相同 rid 返回 `{ "success": false, "duplicated": true }`。

收到响应后同步歌单；请求发出后本地尚未接受更新状态，且成功响应中的歌曲加入本地歌单副本后，完整 Hash 与服务端一致时，只补入新增歌曲并保留已有歌曲对象，省去本次拉取。迟到响应不会清空新的输入或关闭新窗口。

新旧接口共用 `songOperation` 执行逻辑和操作日志记录：新添加以服务器当前歌单为基础，旧接口保留客户端 Hash 的回放合并。先同步更新内存歌单及日志，再持久化并通知客户端。房间缓存和操作日志仍为进程内状态，部署保持单后端实例。

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

搜索时会先把关键词做 `normalizeSearchText`：

- 全部转成小写
- 去掉空格和大部分标点符号
- 去掉中英文括号、书名号、引号等包裹字符
- 保留中文、日文、英文和数字本身

这套规则会同时用于搜索缓存 key、搜索目录匹配以及标题、标签、分P名字的局部匹配

举个例子，歌曲标题里如果出现：

`【カラオケ字幕】【纯k投屏自用】StarDivine`

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

## 部署与开发

预构建镜像部署、源码部署及后续更新步骤见 [使用指南](readme.md#自行部署)。以下源码构建及调试命令均需在完整仓库根目录运行，使用仓库内包含 `build` 配置的 `docker-compose.yml`。

### 构建资源不足时：通过 CI 发布镜像

如果服务器在 `pnpm build` 或 `docker compose build` 时容易因为磁盘 IO 卡死，建议把部署流程改成：

- GitHub Actions 负责构建并推送 `backend` / `frontend` 镜像到 `GHCR`
- 服务器只做 `git pull`、`docker compose pull`、`docker compose up -d`
- 不要在服务器执行 `pnpm build`
- 不要在服务器执行 `docker compose up --build`

采用上述镜像发布方式后，服务器部署步骤如下；源码部署步骤见 [使用指南](readme.md#方式二源码部署)。

```shell
cd ~/ktv-song-web

git fetch --all
git checkout master
git pull --ff-only

docker compose pull
docker compose up -d --force-recreate --remove-orphans
```

如果服务器的端口映射和仓库默认值不同，不要直接改受 Git 管理的 `docker-compose.yml`，建议在服务器本机额外放一个 `docker-compose.override.yml`，只覆盖端口：

```yaml
services:
  ktv-web-backend:
    ports:
      - "旧后端端口:5823"

  ktv-web-frontend:
    ports:
      - "旧前端端口:5526"
```

这样以后服务器执行 `git pull --ff-only` 时，不会因为端口改动和仓库内容冲突。

### GitHub Actions 镜像发布说明

仓库内的 `.github/workflows/docker-release.yml` 现在会：

- 在 `master` 分支推送时自动构建并推送镜像
- 在打 `v*` tag 时自动构建并推送版本镜像
- 推送到 `GHCR`

镜像标签规则：

- `master` 分支：推送分支标签，并更新 `latest`
- `v*` tag：推送语义化版本标签，例如 `0.4.1`

服务器通常直接拉：

- `ghcr.io/<owner>/ktv-song-web-backend:latest`
- `ghcr.io/<owner>/ktv-song-web-frontend:latest`

如果仓库是私有的，还需要让服务器先登录 GHCR：

```shell
echo <GHCR_TOKEN> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

其中 `<GHCR_TOKEN>` 需要至少具备读取包的权限。

### 使用 Docker Compose 开发调试（不在宿主机安装依赖）

项目的 `backend/Dockerfile` 与 `frontend/Dockerfile` 会在镜像构建阶段安装依赖并打包，因此你可以直接用 Docker 进行调试与验证，而无需在宿主机执行 `npm install` / `pnpm install` 产生 `node_modules`。

```shell
# 构建并启动（会重新 build 两个镜像）
docker compose up -d --build --force-recreate --remove-orphans

# 查看日志
docker compose logs -f ktv-web-backend
docker compose logs -f ktv-web-frontend
```

访问：`http://localhost:5526/`（首页创建或加入房间；房间需要先创建，创建成功后即可分享链接，如 `http://localhost:5526/?roomId=demo`）

如果你想直接调后端接口，可以先用 POST 创建演示房间：

```shell
curl -X POST "http://localhost:5823/api/createRoom?roomId=demo"
```

然后再访问：`http://localhost:5823/api/songListInfo?roomId=demo`

> 注意：`/api/songListInfo` 对**不存在的房间**会返回 `404`（`{"success":false,"msg":"房间不存在"}`），不再像以前那样"进空房间自动建房"。这样可以避免两拨人使用同一个房间号导致串房。

#### 房间创建 / 加入逻辑

- 首页提供**创建房间**和**加入房间**两个入口：
  - **创建房间**：`POST /api/createRoom?roomId=X`，房间已存在时返回 `{"success":false,"msg":"房间已存在"}`；不存在则原子创建并返回 `{"success":true,"roomId":X}`。
  - **加入房间**：`GET /api/roomExists?roomId=X` 校验房间存在（`{"exists":true|false}`）后再进入；不存在会提示"房间不存在，请先创建房间"。
- 后端通过 Redis `SET NX` 原子创建房间，两拨人同时抢同一个房间号时只有一方能成功。
- 直连分享链接访问不存在的房间时，前端会显示"房间不存在或已失效"并引导返回首页，不会自动建房。
- 房间创建时写入空的 `ktv_room_<roomId>` 数据，TTL 与歌曲列表一致（默认 `1 day`，对应 `CACHE_DATA_EXPIRE_TIME`）。

#### 房间存档（历史只读数据）

- 房间号只是 live 维度的"配对码"：Redis `ktv_room_<roomId>` 带空闲 TTL（默认 `1 day`，活跃房间每次写入自动续期），过期即大厅关闭，房号可被复用。
- 每个房间创建时生成一个 `uuid`（随歌单数据保存），作为**存档维度**的持久身份；后端每次写透同步 upsert 到 SQLite（`ROOM_ARCHIVE_DB_PATH`，默认 `/app/data/rooms.db`，挂载在 `ktv_room_archive` volume，`--force-recreate` 不会丢失）。
- 只读接口：`GET /api/roomArchive?uuid=...` 按 uuid 读回该房间当时的 `roomId` 与歌单数据；不存在返回 404。该接口不写 Redis、不影响 live 房间。
- 存量房间没有 uuid，不参与存档、不迁移。
- 房间页在房间号下方显示 UUID；成功载入房间后自动将 UUID 保存到当前浏览器的 `localStorage.ktv_room_history`，同一 UUID 不重复记录。
- 首页下方的「历史房间记录」进入 `/history`，以房间列表为主，点击房间即可查看历史歌单。「导入 / 导出」按钮进入独立页面 `/history/transfer`，支持按 UUID 批量导入，以及勾选后通过「导出到文件」下载文本文件，或通过「导出到剪贴板」直接复制（均为每行一个 UUID，可再次粘贴导入）。导入会验证存档存在，失败项保留供重试。记录只存在当前浏览器，清理浏览器数据会移除本机列表，SQLite 存档不受影响。
- `/history/:uuid` 只读展示正在唱、待唱和已唱列表；通过刷新获取最新存档。接口同时返回 `createdAt`、`updatedAt` 和 `active`，其中 `active` 必须匹配 Redis 当前房间的 UUID，房间号复用不会让旧存档显示为活跃。
- 活跃存档可直接进入房间，进入前通过 `/api/roomExists?roomId=...&uuid=...` 再次校验身份。历史查看不会给 Redis 房间续期或恢复已关闭的房间。
- 后端存档与切歌测试使用内存 SQLite 和隔离的存储替身，不依赖运行中的 Redis；SQLite 重启持久化测试使用独立临时目录，不写入现有 `rooms.db`。

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
        # 房间存档 SQLite 文件路径 默认 <运行目录>/data/rooms.db（Docker 下即 /app/data/rooms.db）
        - ROOM_ARCHIVE_DB_PATH=/app/data/rooms.db
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

依赖安装、配置、构建和更新步骤见 [源码部署](readme.md#方式二源码部署)。

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

前端默认访问地址为 `http://localhost:5526/`，后端接口地址为 `http://localhost:5823`。
