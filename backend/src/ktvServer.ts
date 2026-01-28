import process from "node:process";
import ktvLogger from "@/logger";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from 'koa-bodyparser';
import websockify from 'koa-websocket';
import { Storage } from "@/storage";
import { getHash, resolveBilibiliData, songOperation } from "@/utils";
import { IdentifiedWebSocket, OpLog, Song, SongOperationBody, WsReadyState } from "@/types";

const DATABASE_NAME = "ktv_room" as const;

export function runKTVServer(redisUrl?: string) {
    const app = websockify(new Koa());
    const router = new Router();
    app.use(bodyParser());

    const DEFAULT_CACHE_DATA_EXPIRE_TIME = 24 * 60 * 60 * 1000;
    const DEFAULT_CACHE_OP_EXPIRE_TIME = 5 * 60 * 1000;

    const storage = new Storage(redisUrl);

    // 校验 roomId
    const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;
    const CACHE_EXPIRE_TIME = Number(process.env.CACHE_DATA_EXPIRE_TIME) || DEFAULT_CACHE_DATA_EXPIRE_TIME;
    const CACHE_OP_EXPIRE_TIME = Number(process.env.CACHE_OP_EXPIRE_TIME) || DEFAULT_CACHE_OP_EXPIRE_TIME;

    // 缓存变量，按 roomId 分隔
    const roomOpCache: Record<string, OpLog[]> = {}
    const roomSongsCache: Record<string, Song[]> = {}

    // 检测并清理缓存
    setInterval(() => {
        const now = Date.now();
        for (const roomId in roomOpCache) {
            roomOpCache[roomId] = roomOpCache[roomId].filter(log => now - log.timestamp < CACHE_OP_EXPIRE_TIME);
            if (!roomOpCache[roomId]?.length) {
                delete roomOpCache[roomId];
                delete roomSongsCache[roomId];
            }
        }
    }, CACHE_OP_EXPIRE_TIME);

    // 存储房间 ID 与客户端集合的映射
    const roomClients = new Map<string, Set<IdentifiedWebSocket>>();
    // 封装广播通知函数
    const notifyUpdate = (roomId: string, hash: string) => {
        const clients = roomClients.get(roomId);
        if (clients) {
            const message = JSON.stringify({ type: 'UPDATE', hash });
            clients.forEach(ws => {
                if (ws.readyState === WsReadyState.OPEN) {
                    ws.send(message);
                    ktvLogger.debug(`[WS-NOTIFY] -> Room: ${roomId} | Target: ${ws.clientId} | Hash: ${hash.slice(0, 6)}`);
                }
            });
        }
    };

    // WebSocket 路由：处理连接与房间加入
    const wsRouter = new Router();
    wsRouter.all('/api/ws', async (ctx) => {
        const roomId = ctx.query.roomId as string;
        if (!roomId) return ctx.websocket.close();
        const clientId = (ctx.query.nickname as string) || `anon-${Math.random().toString(36).slice(-4)}`;
        const ws = ctx.websocket as IdentifiedWebSocket;
        if (!roomClients.has(roomId)) roomClients.set(roomId, new Set());
        const clients = roomClients.get(roomId)!;
        clients.add(ws);

        ktvLogger.info(`WS Connected: Room ${roomId} | Client: ${clientId} | Total: ${clients.size}`);

        ctx.websocket.on('close', () => {
            clients.delete(ws);
            if (clients.size === 0) roomClients.delete(roomId);
            ktvLogger.info(`WS Leave: Room: ${roomId} | Client: ${clientId}`);
        });
    });


    // 获取歌曲列表及当前哈希
    router.get('/api/songListInfo', async (koaCtx) => {
        const { roomId: roomIds, lastHash: clientHashs } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const clientHash = Array.isArray(clientHashs) ? clientHashs.at(0) : clientHashs;
        ktvLogger.debug('get: ', roomId, clientHash)
        // 初始化歌曲缓存
        if (!roomSongsCache[roomId]) {
            const dbData = await storage.get<Song[]>(DATABASE_NAME, roomId);
            roomSongsCache[roomId] = dbData || [];
        }

        const currentSongs = roomSongsCache[roomId];
        const serverHash = getHash(currentSongs);

        // clientHash 为空或不匹配时
        if (clientHash && clientHash === serverHash) {
            return koaCtx.body = { changed: false, hash: serverHash };
        }

        koaCtx.body = {
            changed: true,
            list: currentSongs,
            hash: serverHash
        };
    });

    // 打乱歌曲接口
    router.post('/api/shuffle', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        ktvLogger.debug('shuffle: ', roomId)
        if (!roomId || !roomSongsCache[roomId]) {
            ktvLogger.debug('REJECT', 'Room not found')
            koaCtx.body = { success: false, msg: 'Room not found' };
            return;
        }

        const allSongs = [...roomSongsCache[roomId]];
        // 分离已唱和未唱
        const sungSongs = allSongs.filter(s => s.state === 'sung');
        const pendingSongs = allSongs.filter(s => s.state !== 'sung');

        // 仅对未唱歌曲进行 Fisher-Yates Shuffle
        for (let i = pendingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pendingSongs[i], pendingSongs[j]] = [pendingSongs[j], pendingSongs[i]];
        }

        const finalSongs = [...pendingSongs, ...sungSongs];

        // 重置缓存
        roomSongsCache[roomId] = finalSongs;
        roomOpCache[roomId] = [];
        await storage.set(DATABASE_NAME, roomId, finalSongs, CACHE_EXPIRE_TIME);
        const finalHash = getHash(finalSongs);
        koaCtx.body = { success: true, hash: finalHash };
        notifyUpdate(roomId, finalHash)
    });

    // 切歌接口 (下一首)
    router.post('/api/nextSong', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const { idArrayHash } = koaCtx.request.body as { idArrayHash: string };
        ktvLogger.debug('nextSong: ', roomId, idArrayHash)

        if (!roomSongsCache[roomId]) {
            roomSongsCache[roomId] = (await storage.get<Song[]>(DATABASE_NAME, roomId) || []);
        }

        const currentSongs = roomSongsCache[roomId];
        // 找到第一首待唱歌曲
        const nextSongIdx = currentSongs.findIndex(s => !s.state || s.state === 'queued');
        if (nextSongIdx === -1) {
            return koaCtx.body = { success: false, msg: '队列中没有待唱歌曲' };
        }

        const song = { ...currentSongs[nextSongIdx], state: 'sung' as const };
        // 将其移动到列表末尾（已唱列表的最后） 这里是把[待唱，已唱]看成一个整体来操作
        const toIndex = currentSongs.length - 1;

        const serverHash = getHash(currentSongs);
        const currentOp: OpLog = {
            baseIdArray: currentSongs.map(s => s.id),
            baseHash: serverHash,
            song: song,
            toIndex: toIndex,
            timestamp: Date.now()
        };
        ktvLogger.debug('nextSong OP: ', roomId, currentOp);

        const logs = roomOpCache[roomId] || [];
        const latest = idArrayHash === serverHash;
        let hitIdx = -1;
        if (!latest) {
            for (let i = logs.length - 1; i >= 0; i--) {
                if (logs[i].baseHash === idArrayHash) {
                    hitIdx = i;
                    break;
                }
            }
            if (hitIdx === -1) return koaCtx.body = { success: false, code: 'REJECT' };
        }

        const baseIdArray = latest ? currentSongs.map(s => s.id) : [...logs[hitIdx].baseIdArray];
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];

        try {
            const finalSongs = songOperation([...currentSongs], baseIdArray, laterOps, currentOp);
            const finalHash = getHash(finalSongs);
            logs.push(currentOp);
            if (logs.length > 50) logs.shift();
            roomSongsCache[roomId] = finalSongs;
            roomOpCache[roomId] = logs;
            await storage.set(DATABASE_NAME, roomId, finalSongs, CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash };
            notifyUpdate(roomId, finalHash)
        } catch (e) {
            ktvLogger.debug('REJECT')
            koaCtx.body = { success: false, code: 'REJECT' };
        }
    });

    //解析b站短链接
    router.post('/api/parseLink', async (koaCtx) => {
        let { link } = koaCtx.request.body as { link: string };
        ktvLogger.debug('parse link: ', link)
        // 如果是 B 站链接
        if (link && (link.includes('b23.tv') || link.includes('bilibili.com') || link.match(/BV[a-zA-Z0-9]{10}/i))) {
            const biliData = await resolveBilibiliData(link);
            if (biliData) {
                // 更新 URL
                link = biliData.url;
            }
        }
        koaCtx.body = { success: true, link };
    });

    // Move/Add/Delete 逻辑
    router.post('/api/songOperation', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        if (!ROOM_ID_REGEX.test(roomId)) {
            ktvLogger.debug('REJECT', 'Invalid Room ID')
            return koaCtx.body = { success: false, msg: 'Invalid Room ID' };
        }
        const body = koaCtx.request.body as SongOperationBody;
        const { idArrayHash, song, toIndex } = body;
        ktvLogger.debug('post:', roomId, 'base on', idArrayHash, 'put', song?.id, 'to', toIndex);
        // ktvLogger.debug(song?.title,'POST AT:', Date.now())
        // ktvLogger.debug(song?.title,'POST AT:', Date.now())

        // 如果是 B 站链接
        if (song && song.url && (song.url.includes('b23.tv') || song.url.includes('bilibili.com') || song.url.match(/BV[a-zA-Z0-9]{10}/i))) {
            const biliData = await resolveBilibiliData(song.url);
            if (biliData) {
                // 更新 URL
                song.url = biliData.url;
                if (!song.title) {
                    song.title = `${song.title}${biliData.pNum ? `(p${biliData.pNum})` : ''}`;
                }
            }
        }

        // 确保缓存存在，防止服务器重启后第一个请求是 POST 导致报错
        if (!roomSongsCache[roomId]) {
            roomSongsCache[roomId] = (await storage.get<Song[]>(DATABASE_NAME, roomId) || []);
        }
        const allSongs = [...roomSongsCache[roomId]];
        const waitingLength = allSongs.filter(s => s.state !== 'sung').length;
        const serverHash = getHash(allSongs);
        const alreadyHad = allSongs.some(s => s.id === song.id)


        const currentOp: OpLog = {
            // 这是提前配置好了变基后的数据
            baseIdArray: allSongs.map(s => s.id),
            baseHash: serverHash,
            song: song,
            // 这里的toIndex不是变基后的，songOperation函数内会自动修正
            toIndex: toIndex >= waitingLength ? allSongs.length - (alreadyHad ? 1 : 0) : toIndex,
            timestamp: Date.now()
        };
        // ktvLogger.debug(song?.title,'BUILD AT:', Date.now())


        const logs: OpLog[] = roomOpCache[roomId] || [];
        const latest: boolean = idArrayHash === serverHash;
        // 这里是找最后一位匹配项
        let hitIdx = -1;
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].baseHash === idArrayHash) {
                hitIdx = i;
                break;
            }
        }
        ktvLogger.debug('server song lists:', allSongs.map(s => s.id));
        ktvLogger.debug(song?.title, 'FIND INDEX:', { hitIdx, latest, serverHash, logsLength: logs?.length })

        // REJECT 逻辑：如果前端传来的 Hash 在日志里找不到
        // 可能是因为服务器重启导致 Log 丢失，或者前端落后太多
        if (!latest && hitIdx === -1) {
            ktvLogger.debug('REJECT')
            return koaCtx.body = { success: false, code: 'REJECT' };
        }

        const baseLog = logs.at(hitIdx);
        const baseIdArray = latest ? allSongs.map(s => s.id) : [...baseLog.baseIdArray];
        // ktvLogger.debug(song?.title,'BASE ARRAY AT:', Date.now())
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];
        // ktvLogger.debug(song?.title,'LATER OPS AT:', Date.now())

        try {
            // 执行重演逻辑
            // ktvLogger.debug(currentOp?.song?.title,'IN AT:', Date.now())
            const tempSongs = songOperation(allSongs, baseIdArray, laterOps, currentOp);
            const queueSongs = tempSongs.filter(s => s.state !== 'sung');
            const sungSongs = tempSongs.filter(s => s.state === 'sung');
            const finalSongs = [...queueSongs, ...sungSongs];
            // ktvLogger.debug(currentOp?.song?.title,'OUT AT:', Date.now())
            const finalHash = getHash(finalSongs);
            ktvLogger.debug('new hash:', finalHash);
            logs.push(currentOp);
            // ktvLogger.debug(currentOp?.song?.title,'PUSH AT:', Date.now())

            if (logs.length > 50) logs.shift();

            roomSongsCache[roomId] = finalSongs;
            roomOpCache[roomId] = logs;
            // ktvLogger.debug(currentOp?.song?.title,'SYNC AT:', Date.now())
            await storage.set(DATABASE_NAME, roomId, finalSongs, CACHE_EXPIRE_TIME);
            // ktvLogger.debug(currentOp?.song?.title,'CACHE AT:', Date.now())
            koaCtx.body = { success: true, hash: finalHash, song };
            // console.log(finalSongs)
            notifyUpdate(roomId, finalHash)
        } catch (e) {
            ktvLogger.error("Operation re-run failed:", e);
            koaCtx.body = { success: false, code: 'REJECT' };
            ktvLogger.debug('REJECT')
        }
    });

    app.ws.use(wsRouter.routes() as any);
    app.use(router.routes()).use(router.allowedMethods());

    // 返回 app
    return app;
}

