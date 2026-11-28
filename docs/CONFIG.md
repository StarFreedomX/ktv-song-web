# 配置参数

安装、启动与升级步骤见[开发与部署指南](../develop.md#自行部署)。

## 配置写在哪里

| 运行方式 | 配置位置 |
| --- | --- |
| 源码或 Release 压缩包 | 后端写在 `backend/.env.local`，前端写在 `frontend/.env.local`；若分别解压了独立包，则写在各自解压目录的 `.env.local` |
| Vite 开发服务 | 后端地址写在 `frontend/.env.local`；使用模式专用配置时，`.env.development` 或 `.env.development.local` 中的同名值优先 |
| Docker Compose | 后端参数写在 `services.ktv-web-backend.environment`，前端对外端口写在 `services.ktv-web-frontend.ports` |

Node.js 前后端和 Vite 都会优先读取进程中已有的环境变量。未设置时，Node.js 启动脚本依次读取各自目录的 `.env.local` 和 `.env`（`.env.local` 优先），修改后需重启对应服务。Vite 的模式加载顺序见[环境变量与模式](https://vite.dev/guide/env-and-mode.html#env-files)。

Compose 中声明的容器环境变量会覆盖镜像默认值。仅把变量写进部署目录的 `.env` 不会自动传入容器，仍需在 Compose 文件中引用；修改 Compose 配置后，在部署目录重新运行 `docker compose up -d` 即可生效。优先级规则详见 [Compose 环境变量优先级](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)。

## 后端

### 监听、存档与日志

| 参数 | 默认值 | 说明与调整时机 |
| --- | --- | --- |
| `HOST` | `localhost`（Docker 为 `0.0.0.0`） | 前端部署在另一台机器时，改为前端可访问的监听地址 |
| `PORT` | `5823` | 端口冲突时修改，并同步更新前端代理目标；使用 Docker 镜像时建议保留容器内默认端口 |
| `REDIS_URL` | `redis://localhost:6379`（Docker 为 `redis://redis:6379`） | 使用独立 Redis 或非默认端口时，填后端可访问的连接地址 |
| `ROOM_ARCHIVE_DB_PATH` | 后端运行目录下的 `data/rooms.db`（Docker 为 `/app/data/rooms.db`） | 确保目录可写，Docker 中放在持久卷内；迁移路径时需同步迁移原数据库文件，否则新路径会新建空库 |
| `DEBUG_MODE` | `info` | 可选 `error`、`warn`、`info`、`debug`、`trace`，日志量依次增多，排查问题时可临时调高 |
| `NODE_ENV` | `production`（`pnpm dev` 与 `dev-watch` 设为 `development`） | 生产环境保持 `production`，本地开发直接使用现有开发命令即可 |

### 房间有效期、操作日志和搜索缓存

下表中的时长参数均支持 `ms`、`s`、`m`、`h`、`d` 后缀；纯数字按毫秒解析（例如 `300000` 等同于 `5m`），留空或格式无效时回退到默认值。

| 参数 | 默认值 | 生效范围 |
| --- | --- | --- |
| `CACHE_DATA_EXPIRE_TIME` | `24h` | Redis 中活跃房间的空闲过期时间。建房或写入歌单时重新计时，单纯查看歌单或历史记录不会续期；修改后，已有房间会在下一次写入时生效 |
| `CACHE_OP_EXPIRE_TIME` | `5m` | 后端进程内队列操作日志的保留时长与清理周期。客户端提交的旧歌单版本超出保留范围时，需要刷新后再操作 |
| `RID_EXPIRED_TIME` | `1m` | 携带相同 `request-id` 的 POST 请求去重窗口 |
| `SEARCH_CACHE_EXPIRE_TIME` | `24h` | Redis 中按关键词缓存的 B 站搜索结果有效期 |
| `SEARCH_CATALOG_EXPIRE_TIME` | `14d` | Redis 中所有房间共享的 B 站搜索目录有效期，用于匹配已有条目 |

B 站搜索的点击热度单独保存，自最近一次点选起保留 365 天，不受上述两个搜索缓存参数影响。活跃房间过期只影响 Redis，不会删除 SQLite 中的历史存档；迁移站点时建议同时备份 Redis 和 SQLite。

### B 站封面代理

网页会优先直连 B 站封面，加载失败时才尝试走后端代理。只有在设置 `ENABLE_BILIBILI_IMAGE_PROXY=true` 后，搜索结果才会附带代理地址；代理接口仅允许拉取 `hdslb.com` 及其子域名的 HTTPS 图片。

| 参数 | 默认值 | 单位与用途 |
| --- | --- | --- |
| `ENABLE_BILIBILI_IMAGE_PROXY` | `false` | 设为小写 `true` 开启封面代理 |
| `IMAGE_CACHE_EXPIRE_TIME` | `24h` | 后端内存中代理封面的缓存时长，支持时长后缀；浏览器端缓存固定为 24 小时，不受此项影响 |
| `IMAGE_CACHE_MAX` | `500` | 后端内存缓存最多保留的封面数量（张） |
| `IMAGE_CACHE_MAX_SIZE` | `52428800`（50 MiB） | 所有已缓存封面的总大小上限（字节） |
| `IMAGE_PROXY_MAX_BYTES` | `5242880`（5 MiB） | 单次代理请求允许下载的最大图片体积（字节） |
| `IMAGE_PROXY_TIMEOUT_MS` | `8000`（8 秒） | 后端拉取 B 站图片的请求超时（毫秒） |

调低缓存张数或总大小上限可减少后端内存占用。除 `IMAGE_CACHE_EXPIRE_TIME` 外，其余字节数和超时参数均直接填纯数字（例如超时写 `8000`，不要写 `8s`）。

## 前端

| 参数 | 默认值 | 适用范围 |
| --- | --- | --- |
| `HOST` | `localhost` | Node.js 前端的监听地址；局域网其他设备需要访问时设为 `0.0.0.0` |
| `PORT` | `5526` | Node.js 前端的监听端口 |
| `BACKEND_URL` | `http://localhost:5823` | Node.js 前端和 Vite 开发服务的后端代理地址，HTTP API 和 WebSocket 共用 |

Vite 开发服务不读取这里的 `HOST` 和 `PORT`。开发时如需调整监听地址或端口，可从仓库根目录运行 `pnpm --filter ./frontend dev --host 0.0.0.0 --port 5173`。

Docker 前端容器使用 Nginx 托管静态页面，容器内监听 `5526` 端口，`/api/` 反向代理固定指向 `http://ktv-web-backend:5823/api/`。给 Docker 前端设置 `HOST`、`PORT` 或 `BACKEND_URL` 都不会生效。改网页对外端口只需修改 Compose 映射左侧（如 `"8080:5526"`）；如需修改 Nginx 的后端代理目标，请调整 [Nginx 模板](../frontend/nginx.conf.template) 后重新构建前端镜像。

## Docker 构建参数

从源码构建镜像时，前后端 Dockerfile 均接受 `NPM_CONFIG_REGISTRY` 构建参数，可在执行 `docker compose build` 时通过 `--build-arg` 传入，或在对应服务的 `build.args` 中配置。它仅用于镜像构建阶段安装项目依赖，不影响容器运行，也不影响前一步全局安装 `pnpm` 时使用的源。

## 常用配置示例

例如，允许同一局域网设备访问，并将活跃房间的空闲有效期延长到 2 天。在源码或整合压缩包部署中分别设置：

```dotenv
# backend/.env.local
CACHE_DATA_EXPIRE_TIME=48h
```

```dotenv
# frontend/.env.local
HOST=0.0.0.0
```

使用 Docker Compose 时，在已有配置中补充后端环境变量，并按需替换前端对外端口映射（下例改到宿主机 `8080` 端口）：

```yaml
services:
  ktv-web-backend:
    environment:
      CACHE_DATA_EXPIRE_TIME: 48h
  ktv-web-frontend:
    ports:
      - "8080:5526"
```
