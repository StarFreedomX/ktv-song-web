# 遥控接口协议

版本：1

服务端居中。执行端（投屏 App）与控制端（浏览器）接入同一条 WS，用注册消息区分角色。

## 1. 约定

- 消息为 UTF-8 文本 JSON，单条不超过 16 KiB。
- 除心跳外，本协议消息顶层带 `v`，固定为 `1`。
- 遥控消息的 `type` 统一使用 `remote:` 前缀。同一连接上的歌单同步（`UPDATE`）与心跳（`ping`/`pong`）不属于本协议，不使用该前缀。
- 字段缺失或为 `null` 表示该值未知。
- `position`、`duration` 单位为秒（浮点）；`receivedAt` 为毫秒时间戳（整数）。
- 第 6 节的命令为协议全集，未列出的命令一律拒绝。

## 2. 通道

| 角色 | 接入 | 身份 |
| --- | --- | --- |
| 执行端 | WS `/api/ws?roomId=…`，连接后发送注册消息 | `appId` + `sessionId` |
| 控制端 | WS `/api/ws?roomId=…`，不注册 | 无 |

歌单同步消息（`UPDATE`）对所有连接照常推送，与是否注册无关。

控制端未建立 WS 时使用第 6 节的 HTTP 接口；执行端必须使用 WS。

## 3. 注册

执行端在同一条连接上发送：

```json
{"v":1,"type":"remote:register","appId":"phone-abc","name":"客厅手机",
 "target":{"name":"客厅电视","mode":"dlna"}}
```

成功：

```json
{"v":1,"type":"remote:registered","appId":"phone-abc","sessionId":"6f1c1b8e-0d1a-4f0e-9a5e-2f5c9c3a1b77"}
```

| 字段 | 约束 |
| --- | --- |
| `appId` | 安装标识，`[a-zA-Z0-9_-]{1,128}`，与房间存档 UUID 无关 |
| `name` | 去首尾空白后 1–80 字符 |
| `target.name` | 去首尾空白后 1–80 字符 |
| `target.mode` | `dlna`、`bilibili` 或 `local` |

`target.mode` 表示当前播放输出：`dlna` 为 DLNA 投屏，`bilibili` 为小电视投屏，`local` 为本机播放。输出切换后由执行端重新注册。

会话规则：

- 每个连接只注册一次。
- 同一房间内相同 `appId` 的新注册顶替旧会话，旧连接关闭。
- 每次注册生成新的 `sessionId`，命令以它为寻址依据。

注册失败返回错误，连接保持，更正后可重发：

```json
{"v":1,"type":"remote:error","code":"INVALID_REGISTER","msg":"注册信息无效"}
```

| code | 含义 |
| --- | --- |
| `INVALID_MESSAGE` | 非 JSON、二进制消息或超过 16 KiB |
| `INVALID_REGISTER` | 注册字段不合法 |
| `ALREADY_REGISTERED` | 同一连接重复注册 |
| `NOT_REGISTERED` | 执行端未注册就上报状态 |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `SERVICE_UNAVAILABLE` | 服务端异常 |

## 4. 播放状态

执行端在任一字段变化时上报，无变化时每 5 秒补一次采样；连接建立后立即上报一帧：

```json
{"v":1,"type":"remote:playback","playback":{
  "seq":42,
  "position":128.4,
  "duration":240,
  "volume":40,
  "isPlaying":true,
  "qualities":[
    {"qn":80,"format":"dash","label":"1080P高清","now":true},
    {"qn":64,"format":"dash","label":"720P准高清"}
  ],
  "capabilities":{"absoluteVolume":true,"seek":true,"quality":true}}}
```

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `seq` | number | 执行端递增；接收方丢弃小于当前值的快照 |
| `position` | number \| null | 播放位置（秒） |
| `duration` | number \| null | 总时长（秒） |
| `volume` | number \| null | 0–100；`null` 表示无绝对音量 |
| `isPlaying` | boolean | 正在播放 |
| `qualities` | array | 当前可用档位，随歌曲变化；查询失败时为空数组 |
| `qualities[].qn` | number | 档位值 |
| `qualities[].format` | string \| 缺失 | 媒体格式，B 站模式省略 |
| `qualities[].label` | string | 显示名称 |
| `qualities[].now` | boolean | 当前档位；至多一条为 `true`，档位未知时不出现 |
| `capabilities.absoluteVolume` | boolean | 支持绝对音量 |
| `capabilities.seek` | boolean | 支持拖动进度 |
| `capabilities.quality` | boolean | 支持切换档位 |

服务端收到后补充 `receivedAt`（毫秒时间戳），保存为该执行端的最新快照。

控制端据此推算进度条位置：收到快照时以本地时刻为基准，`isPlaying` 为真时按已过时间推进：

```
显示位置 = position + (本地当前时刻 − 收到时刻) / 1000
```

收到 `seq` 更大的快照时重置基准；推进到 `duration` 即停；`position` 或 `duration` 为 `null` 时不推进。

## 5. 控制端获取状态

### 5.1 WS 推送

服务端向房间内所有连接推送 `remote:state`，负载为执行端标识与完整快照：

```json
{"v":1,"type":"remote:state","appId":"phone-abc","playback":{
  "seq":42,"receivedAt":1762759200123,
  "position":128.4,"duration":240,"volume":40,"isPlaying":true,
  "qualities":[{"qn":80,"format":"dash","label":"1080P高清","now":true}],
  "capabilities":{"absoluteVolume":true,"seek":true,"quality":true}
}}
```

执行端注册或离线时推送 `remote:apps`，无负载：

```json
{"v":1,"type":"remote:apps"}
```

### 5.2 HTTP 查询

```
GET /api/remote/state?roomId=…
```

```json
{"success":true,"apps":[{
  "appId":"phone-abc","sessionId":"6f1c1b8e-0d1a-4f0e-9a5e-2f5c9c3a1b77","name":"客厅手机",
  "target":{"name":"客厅电视","mode":"dlna"},
  "playback":{
    "seq":42,"receivedAt":1762759200123,
    "position":128.4,"duration":240,"volume":40,"isPlaying":true,
    "qualities":[{"qn":80,"format":"dash","label":"1080P高清","now":true}],
    "capabilities":{"absoluteVolume":true,"seek":true,"quality":true}
  }
}]}
```

无在线执行端时 `apps` 为空数组；房间号非法返回 400，房间不存在返回 404。响应禁用缓存。

### 5.3 使用时机

| 场景 | 方式 |
| --- | --- |
| 控制端已连接 WS | 收到 `remote:state` 直接更新 |
| 首屏、WS 重连 | `GET /api/remote/state` |
| 控制端未连接 WS | 每 5 秒 `GET /api/remote/state` |
| 执行端上线下线 | 收到 `remote:apps` 后 `GET /api/remote/state` |

## 6. 命令

### 6.1 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `appId` | string | 目标执行端 |
| `sessionId` | string | 目标执行端的会话标识 |
| `command` | string | 见 6.4 |
| `payload` | object | 见 6.4，无参数时缺省或为空对象 |

### 6.2 WS 承载

```json
{"v":1,"type":"remote:command","appId":"phone-abc","sessionId":"6f1c1b8e-0d1a-4f0e-9a5e-2f5c9c3a1b77",
 "command":"seek","payload":{"seconds":128}}
```

### 6.3 HTTP 承载

```
POST /api/remote/command?roomId=…
```

```json
{"appId":"phone-abc","sessionId":"6f1c1b8e-0d1a-4f0e-9a5e-2f5c9c3a1b77",
 "command":"seek","payload":{"seconds":128}}
```

受理后返回：

```json
{"success":true}
```

| 状态码 | 条件 |
| --- | --- |
| 200 | 已转发 |
| 400 | 命令、payload 或房间号不合法 |
| 404 | 房间不存在 |
| 409 | 执行端不在线或 `sessionId` 不匹配 |

### 6.4 命令全集

| 命令 | payload | 说明 |
| --- | --- | --- |
| `play` | 无 | 继续播放 |
| `pause` | 无 | 暂停 |
| `seek` | `{"seconds": number}` | 跳到指定秒数，`seconds >= 0` |
| `setQuality` | `{"qn": number, "format"?: string}` | 切换档位，`format` 原样取自 `qualities` |
| `setVolume` | `{"volume": number}` | 绝对音量，0–100 |
| `changeVolume` | `{"increase": boolean}` | 相对音量，`true` 增大 |
| `recast` | 无 | 从头重新投屏当前歌曲 |

命令是输入事件，服务端校验后转发，不返回执行结果。执行时长、执行结果、重复命令的处理由执行端内部决定。

## 7. 服务端行为

- 登记注册过的连接及其 `appId`/`sessionId`，按这两个字段把命令转发给对应连接。
- 校验命令名、`appId`、`sessionId`、payload 类型；不通过则丢弃并记录日志。
- 保存每个执行端的最新快照。
- 快照与在线列表仅保存在进程内，不写 Redis 或房间存档；服务端重启后由执行端重连恢复。

## 8. 保活

心跳由客户端发起：

```json
{"type":"ping"}
{"type":"pong"}
```

服务端收到 `ping` 后回 `pong`。连接断开由 socket 关闭事件感知。

## 9. 版本兼容

- `v` 固定为 `1`；新增字段不提升版本。
- 接收方忽略无法识别的 `type` 与未知字段。
- 变更已有字段语义或命令参数形式时提升 `v`。

## 10. 范围

协议不包含：弹幕、投屏设备发现与切换、队列操作（上一首/下一首使用房间既有接口 `/api/prevSong`、`/api/nextSong`）。