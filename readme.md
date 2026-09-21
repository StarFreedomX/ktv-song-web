# KTV Song List Web

一个方便多人一起点歌的网页应用。创建房间后，把链接分享给朋友，即可一起添加歌曲、管理待唱顺序，并同步查看正在唱、待唱和已唱的歌曲。

支持解析 B 站分享内容，也可以直接搜索 B 站 KTV 视频点歌。

回到前台、页面恢复、网络恢复或 WebSocket 连接成功时，页面会主动校验并同步歌单；相邻的恢复事件会合并处理。同步请求串行执行，期间收到的新通知会在本次结果应用后触发一次补拉；歌单请求超过 10 秒会取消，失败后 3 秒自动重试。

## 开始使用

1. 打开网站，在首页选择「创建房间」，输入房间号。
2. 将房间链接分享给朋友；朋友也可以选择「加入房间」，输入相同房间号。
3. 进入房间后，打开「添加新歌曲」，搜索或粘贴 B 站分享内容来点歌。添加成功后显示到歌单末尾；网络失败时保留输入，可再次点击提交。
4. 在房间中查看歌单、调整待唱顺序，并在唱完后切换到下一首。

已被使用的房间号不能重复创建，可以换一个房间号，或加入已有房间。

如果分享链接提示「房间不存在或已失效」，请返回首页重新创建或加入房间。房间默认在停止更新歌单约 24 小时后失效，具体时长由部署者设置；查看历史记录不会延长房间有效期。

## B 站点歌

在「添加新歌曲」中输入歌名或关键词，即可查看候选视频并选择加入歌单，也可以粘贴 B 站分享内容让应用自动解析。

- 搜索结果会利用已有搜索记录和点选热度帮助排序，所有房间共享这些搜索信息。
- 应用会根据视频标签、标题和分 P 标题识别伴奏版本，点歌前默认弹出确认提示，可在设置中关闭。
- 如需确认视频内容，可以在搜索弹窗中双击标题打开 B 站查看。

伴奏提示仅供参考，实际是否包含人声请以视频内容为准。

## 历史房间记录

成功进入房间后，应用会在当前浏览器中记住该房间。通过首页的「历史房间记录」，可以查看过去房间的正在唱、待唱和已唱歌单。

- 历史歌单为只读；房间仍然活跃时，可以从历史记录进入房间继续使用。
- 房间关闭后，仍可查看已有存档。同一个房间号以后再次使用，也不会覆盖旧房间的存档。
- 在「导入 / 导出」中，可以勾选记录导出为文本文件或复制到剪贴板，再到其他浏览器粘贴导入。
- 导入内容为每行一个房间 UUID（房间页显示的唯一标识），支持批量导入；导入失败的项目会保留供重试。

清理浏览器数据会移除本机的历史列表，但不会删除服务器上的存档。建议提前导出需要保留的记录；较早版本创建、没有 UUID 的房间不提供存档。

## 投屏

### 使用 ktv-casting-android-app

可搭配 [ktv-casting 投屏后端](https://github.com/aspromise/ktv-casting) 使用。它会跟随当前正在唱的歌曲，并支持歌曲结束后自动切换下一首。

支持 DLNA / 小电视 投屏

### 使用云视听小电视(旧)

在设备上开启「主机模式（HostMode）」和「App 跳转」，应用会跟随当前正在唱的歌曲，在歌曲更改时自动打开 B 站。

在 B 站主页连接投屏设备后，即可配合自动播放和投屏。使用这种方式通常需要设备开启分屏模式。

## 自行部署

如果已经有可用的网站地址，直接打开即可，无需安装。以下步骤适用于希望自行搭建服务的使用者。

可以使用 Docker 镜像部署，也可以通过 pnpm 从源码构建并运行。

### 方式一：使用预构建镜像

安装 Docker 和 Docker Compose 后，新建一个目录，在其中创建 `docker-compose.yml`，填入以下内容：

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
        volumes:
            - ktv_room_archive:/app/data # 房间存档 SQLite 数据（持久化，force-recreate 不丢）

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
    ktv_room_archive:
```

在该目录中运行：

```shell
docker compose up -d
```

启动后，在浏览器打开 [http://localhost:5526/](http://localhost:5526/)，即可创建或加入房间。其他设备访问时，将 `localhost` 换成服务器的 IP 或域名，并确保可以访问对应端口。

上面的配置会持久保存房间存档和歌单数据。更新或重建容器不会删除这些数据，但删除数据卷会导致数据丢失；房间本身仍有有效期。

#### 更新镜像

在部署目录中运行：

```shell
docker compose pull
docker compose up -d --force-recreate --remove-orphans
```

### 方式二：源码部署

准备 Git、Node.js（22 或 24，使用对应版本的最新补丁）和 Redis，并启动 Redis。安装项目指定版本的 pnpm：

```shell
npm install -g pnpm@11.20.0
```

下载源码并构建：

```shell
git clone https://github.com/StarFreedomX/ktv-song-web.git
cd ktv-song-web
pnpm install --frozen-lockfile
pnpm build
```

如果使用的是其他分支或派生仓库，请将仓库地址替换为实际使用的地址，并切换到要部署的分支。

默认连接本机 Redis（`redis://localhost:6379`）。需要修改配置时，将 `backend/.env` 和 `frontend/.env` 分别复制为同目录下的 `.env.local`，再编辑对应配置：

- `backend/.env.local`：通过 `REDIS_URL` 设置 Redis 地址。
- `frontend/.env.local`：其他设备需要访问时，将 `HOST` 设为 `0.0.0.0`；`BACKEND_URL` 默认是 `http://localhost:5823`。

在仓库根目录启动前后端：

```shell
pnpm start
```

启动后打开 [http://localhost:5526/](http://localhost:5526/)。其他设备访问时，将 `localhost` 换成服务器的 IP 或域名。

#### 更新

停止正在运行的服务后，在原来的仓库目录中运行：

```shell
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

保留 `.env.local`、Redis 数据及房间存档文件（默认 `backend/data/rooms.db`）。更多配置项见 [默认配置](develop.md#默认配置)。

## 开发与高级配置

接口说明、缓存机制、环境变量、开发调试和镜像发布流程见 [develop.md](develop.md)。
