# 开发与部署指南

本文面向部署者和开发者：搭建自己的点歌台请看[自行部署](#自行部署)，修改代码或本地联调请看[本地开发](#本地开发)。日常建房、点歌和投屏操作见[使用指南](readme.md)。

## 自行部署

| 方式 | 适用场景 |
| --- | --- |
| [Docker 镜像](#docker-镜像) | 直接在服务器上跑现成镜像，省去安装 Node.js 和构建步骤 |
| [源码部署](#源码部署) | 运行指定分支或自定义代码，自行拉取并构建 |
| [GitHub Release 压缩包](#github-release-压缩包) | 已下载预构建产物，希望用 Node.js 直接运行 |

生产环境只需运行单个后端实例：活跃房间和搜索缓存存在 Redis，历史歌单存档存在 SQLite，而队列操作日志和在线投屏设备状态仅保存在后端进程内存中，多实例之间无法共享。

### Docker 镜像

准备好 Docker 和 Docker Compose 后，新建一个独立部署目录，在其中创建 `compose.yaml` 并填入以下配置。这份配置只对外开放前端网页端口，HTTP API 和 WebSocket 均由前端容器内部反向代理到后端：

```yaml
services:
  ktv-web-backend:
    image: ghcr.io/starfreedomx/ktv-song-web-backend:latest
    restart: unless-stopped
    depends_on:
      - redis
    volumes:
      - ktv_room_archive:/app/data

  ktv-web-frontend:
    image: ghcr.io/starfreedomx/ktv-song-web-frontend:latest
    restart: unless-stopped
    depends_on:
      - ktv-web-backend
    ports:
      - "5526:5526"

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  ktv_room_archive:
  redis_data:
```

首次部署时，在部署目录运行 `docker compose up -d`。启动后打开 `http://localhost:5526/`，其他设备访问时将 `localhost` 换成服务器 IP 或域名。如需更换对外端口，只改 `ports` 映射左侧的宿主机端口（例如 `"8080:5526"`），右侧容器端口保持 `5526`。

更新镜像时，在原部署目录执行：

```sh
docker compose pull
docker compose up -d
```

升级前注意保留并备份 `ktv_room_archive`（历史歌单）和 `redis_data`（活跃房间与搜索缓存）两个数据卷，避免执行会删卷的 `docker compose down -v`。另外，Redis 持久化只保证重启不丢数据，不会取消活跃房间的空闲过期时间。

### 源码部署

准备 Git、Node.js（22 或 24 的最新补丁版）和 Redis。先启动 Redis，再安装仓库 `package.json` 中 `packageManager` 指定的 pnpm 版本，然后拉取源码、构建并启动：

```sh
npm install -g pnpm@11.28.13
git clone https://github.com/StarFreedomX/ktv-song-web.git
cd ktv-song-web
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

启动后打开 `http://localhost:5526/`。后端默认连接本机 `6379` 端口的 Redis；如果 Redis 部署在其他地址，先在 `backend/.env.local` 中配置 `REDIS_URL`。需要局域网或其他设备访问时，在 `frontend/.env.local` 中将 `HOST` 设为 `0.0.0.0`。更多端口和数据路径说明见[默认配置](#默认配置)。

更新版本时，先停止正在运行的前后端，再在原目录执行：

```sh
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

更新过程中保留前后端目录的 `.env.local`、Redis 数据和 SQLite 存档文件（默认 `backend/data/rooms.db`）。

如果通过反向代理提供 HTTPS，只需将流量代理到前端端口，并确保 `/api/ws` 支持 WebSocket Upgrade，无需把后端或 Redis 端口暴露给浏览器。

### GitHub Release 压缩包

环境要求与[源码部署](#源码部署)相同（Node.js、pnpm 和 Redis）。前往 [GitHub Releases](https://github.com/StarFreedomX/ktv-song-web/releases) 下载整合包 `ktv-song-web-unified-*.zip`，解压后在目录内运行：

```sh
pnpm install --prod
pnpm start
```

也可以分别下载后端和前端独立包（`ktv-song-web-backend-*.zip`、`ktv-song-web-frontend-*.zip`），解压后在各自目录执行相同命令，先启动后端。如果前后端不在同一台机器上，需让后端监听前端可达的地址，并在前端 `.env.local` 中将 `BACKEND_URL` 指向后端地址。升级时保留原有的 `.env.local`、Redis 数据和存档文件，或通过 `ROOM_ARCHIVE_DB_PATH` 指定固定存档路径。

### 默认配置

如需调整端口、Redis 地址、房间有效期或封面代理，请查阅[配置参数](docs/CONFIG.md)。其中汇总了各项默认值、填写单位，以及在 Node.js、Vite 和 Docker 下的生效范围。

## 本地开发

`frontend/` 是 Vue 和 Vite 前端，`backend/` 是 TypeScript 和 Koa 后端。两个子目录分别维护各自的 `pnpm-lock.yaml`，日常开发命令统一在仓库根目录运行。

准备好与[源码部署](#源码部署)相同的 Node.js 和 pnpm，启动本机 Redis 后运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

启动后访问 Vite 输出的地址（默认 `http://localhost:5173/`），后端默认监听 `http://localhost:5823/`。若需连接非默认后端地址，在 `frontend/.env.local` 中设置 `BACKEND_URL`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:frontend` | 单独启动前端开发服务器 |
| `pnpm dev:backend` | 单独启动后端服务 |
| `pnpm --filter ./backend dev-watch` | 监听后端源码改动并自动重启 |
| `pnpm --filter ./backend test` | 运行后端 Jest 测试，可在末尾传入具体测试文件名 |
| `pnpm build` | 构建前后端，产物分别输出到 `frontend/dist/` 和 `backend/lib/` |

### 用 Docker 调试

不想在本机安装 Node.js 和 Redis 时，可以直接用仓库根目录的 [docker-compose.yml](docker-compose.yml) 从本地源码构建并启动整套服务：

```sh
docker compose up -d --build
docker compose logs -f ktv-web-backend ktv-web-frontend
```

启动后网页访问 `http://localhost:5526/`，后端调试端口为 `5823`。直接调用后端房间接口时，需先创建房间再读取歌单（查询不存在的房间会返回 `404`，不会自动建房）：

```sh
curl -X POST 'http://localhost:5823/api/createRoom?roomId=demo'
curl 'http://localhost:5823/api/songListInfo?roomId=demo'
```

如果建房、加房或读取歌单返回 `503` 及 `REDIS_UNAVAILABLE`，优先检查 Redis 是否正常以及后端的 `REDIS_URL` 配置。

### 投屏遥控联调

先在测试环境建好 `demo` 房间，再运行模拟脚本（需要 Node.js 22 或更高版本，无需额外安装依赖），并将命令里的地址替换为正在运行的前端地址：

```sh
node scripts/mock-remote-app.mjs http://localhost:5526 demo phone-abc "客厅手机" "客厅电视" dlna
```

位置参数依次为前端地址、房间号、App 标识、App 名称、目标设备名称和播放模式（`dlna`、`bilibili` 或 `local`）。启动后，在房间的「投屏遥控」页应能选到「客厅手机」；操作播放、进度或音量时可对照查看网页状态和终端输出，按 `Ctrl+C` 断开后设备会从在线列表移除。另开终端传入不同的 App 标识可测试多设备切换，传入相同标识可测试新会话顶替旧会话。

对接真实投屏端时，按[遥控接口协议](docs/REMOTE.md)实现注册、控制和状态上报。执行端必须保持 WebSocket 连接；浏览器没有 WebSocket 时可通过 HTTP 下发控制命令，但执行端仍需在线。上一首和下一首直接操作房间歌单队列，不经过投屏端转发。

### 歌单接口兼容性

- **追加歌曲**：新客户端调用 `POST /api/addSong`，无需传歌单 hash 或插入位置。每次提交生成唯一 `request-id` 并在重试时复用，可在去重窗口内防止重复添加；`request-id` 最长 40 个字符，建议使用标准 UUID。
- **编辑歌曲**：修改正在唱的歌曲时，调用 `POST /api/editSong` 按 `songId` 提交 `title` 或 `url` 的改动，即使编辑期间切歌也能更新原歌曲。旧客户端使用的 `/api/editCurrentSong` 和 `/api/songOperation` 仍保持兼容。
- **历史歌单**：读取存档调用 `GET /api/roomArchive?uuid=...`。历史记录以 UUID 区分，判断能否回到当前活跃房间时必须校验 UUID，不能只比对可复用的房间号。

### 队列变基与操作日志

改动队列写入或客户端重试逻辑时，建议用两个客户端从同一份歌单出发并发操作，验证携带旧 hash 时的服务端行为：

- **允许旧 hash**：`/api/songOperation`、`/api/undoSung` 以及待唱队列非空时的 `/api/nextSong`，只要操作日志里还能找到对应的基准版本，即可基于旧 hash 变基执行；找不到基准版本时返回 `REJECT`，客户端应先刷新歌单再按新顺序操作。
- **要求最新 hash**：`/api/editCurrentSong`、`/api/prevSong` 以及待唱队列为空时的 `/api/nextSong` 必须携带最新 hash。执行打乱队列会清空房间操作日志。
- **变基与日志规则**：队列变基按基准顺序 `S_0` 的固定空位锚点落位，重放中间操作时依据每条日志的 `baseIdArray` 和实际执行后的 `toIndex` 还原顺序。切歌或撤回已唱改变待唱队列时，日志记录操作执行前的服务端 hash 和顺序，而非客户端传入的旧 hash。携带旧 hash 请求下一首时，服务端会检查原队首是否仍在待唱队列，若已被移除则返回 `REJECT`。

## 发布

发布前先运行 `pnpm --filter ./backend test` 和 `pnpm build` 确认通过。版本确定后，为目标提交打上并推送 `v*` 标签即可触发发布流程：

| 工作流 | 触发条件与产物 |
| --- | --- |
| [Docker Release](.github/workflows/docker-release.yml) | 推送 `master` 或手动触发仅做构建验证；推送 `v*` 标签时向 GHCR 发布前后端镜像。正式版（如 `v0.7.0`）会同步更新 `latest`，预发布版（如 `v0.7.0-alpha`）只发布对应版本标签 |
| [Full Release](.github/workflows/release.yml) | 推送 `v*` 标签时构建并发布前端、后端及整合版压缩包到 GitHub Release |

发布完成后，核对 GitHub Release 附件及 GHCR 上的前后端镜像标签。测试预发布版本时，在 Compose 中将前后端镜像都显式指定为同一个预发布标签，不要使用 `latest`。
