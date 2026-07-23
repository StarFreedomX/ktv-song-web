import process from "node:process";
import { LRUCache } from 'lru-cache';
import axios from "axios";
import ktvLogger from "@/logger";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from 'koa-bodyparser';
import websockify from 'koa-websocket';
import { Storage } from "@/storage";
import { fetchBilibiliVideoParts, filterBilibiliSearchVideosByRelevance, filterCachedBilibiliSearchVideos, getHash, mergeBilibiliSearchVideos, normalizeSearchText, resolveBilibiliData, searchBilibiliKtvVideos, sortBilibiliSearchVideos, songListTools, songOperation } from "@/utils";
import { BilibiliSearchVideo, DATABASE_NAME, IdentifiedWebSocket, OpLog, SEARCH_CACHE_NAMESPACE, SEARCH_CATALOG_NAMESPACE, SEARCH_CLICK_NAMESPACE, Song, SongLists, SongOperationBody, WsReadyState } from "@/types";

const DURATION_MULTIPLIERS = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
} as const;

function parseDurationMs(value: string | undefined, fallback: number) {
    if (!value) return fallback;

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return fallback;

    const durationMatch = normalizedValue.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
    if (durationMatch) {
        const amount = Number(durationMatch[1]);
        const unit = (durationMatch[2] || 'ms') as keyof typeof DURATION_MULTIPLIERS;
        const multiplier = DURATION_MULTIPLIERS[unit];
        if (Number.isFinite(amount) && amount > 0 && multiplier) {
            return Math.round(amount * multiplier);
        }
        return fallback;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

export function runKTVServer(storage: Storage) {
    const app = websockify(new Koa());
    const router = new Router();
    app.use(bodyParser());

    const DEFAULT_CACHE_DATA_EXPIRE_TIME = 24 * 60 * 60 * 1000;
    const DEFAULT_CACHE_OP_EXPIRE_TIME = 5 * 60 * 1000;
    const DEFAULT_SEARCH_CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;
    const DEFAULT_SEARCH_CATALOG_EXPIRE_TIME = 14 * 24 * 60 * 60 * 1000;
    const DEFAULT_IMAGE_CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;
    const DEFAULT_IMAGE_CACHE_MAX_SIZE = 50 * 1024 * 1024;
    const DEFAULT_IMAGE_CACHE_MAX = 500;
    const DEFAULT_IMAGE_PROXY_MAX_BYTES = 5 * 1024 * 1024;
    const DEFAULT_IMAGE_PROXY_TIMEOUT_MS = 8000;
    const SEARCH_CLICK_TTL_MS = 365 * 24 * 60 * 60 * 1000;

    // 校验 roomId
    const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;
    const BVID_REGEX = /^BV[a-zA-Z0-9]{10}$/;
    const CACHE_EXPIRE_TIME = parseDurationMs(process.env.CACHE_DATA_EXPIRE_TIME, DEFAULT_CACHE_DATA_EXPIRE_TIME);
    const CACHE_OP_EXPIRE_TIME = parseDurationMs(process.env.CACHE_OP_EXPIRE_TIME, DEFAULT_CACHE_OP_EXPIRE_TIME);
    const SEARCH_CACHE_EXPIRE_TIME = parseDurationMs(process.env.SEARCH_CACHE_EXPIRE_TIME, DEFAULT_SEARCH_CACHE_EXPIRE_TIME);
    const SEARCH_CATALOG_EXPIRE_TIME = parseDurationMs(process.env.SEARCH_CATALOG_EXPIRE_TIME, DEFAULT_SEARCH_CATALOG_EXPIRE_TIME);
    const IMAGE_CACHE_EXPIRE_TIME = parseDurationMs(process.env.IMAGE_CACHE_EXPIRE_TIME, DEFAULT_IMAGE_CACHE_EXPIRE_TIME);
    const IMAGE_CACHE_MAX_SIZE = Number(process.env.IMAGE_CACHE_MAX_SIZE) || DEFAULT_IMAGE_CACHE_MAX_SIZE;
    const IMAGE_CACHE_MAX = Number(process.env.IMAGE_CACHE_MAX) || DEFAULT_IMAGE_CACHE_MAX;
    const ENABLE_BILIBILI_IMAGE_PROXY = process.env.ENABLE_BILIBILI_IMAGE_PROXY === 'true';
    const IMAGE_PROXY_MAX_BYTES = Number(process.env.IMAGE_PROXY_MAX_BYTES) || DEFAULT_IMAGE_PROXY_MAX_BYTES;
    const IMAGE_PROXY_TIMEOUT_MS = Number(process.env.IMAGE_PROXY_TIMEOUT_MS) || DEFAULT_IMAGE_PROXY_TIMEOUT_MS;

    // 缓存变量，按 roomId 分隔
    const roomOpCache: Record<string, OpLog[]> = {}
    const roomSongsCache: Record<string, SongLists> = {}
    const imageCache = new LRUCache<string, {
        buffer: Buffer;
        contentType: string;
    }>({
        max: IMAGE_CACHE_MAX,                  // 限制最多缓存 500 张图片
        maxSize: IMAGE_CACHE_MAX_SIZE, // 限制总体积最大 50MB
        sizeCalculation: (value) => value.buffer.length, // 按 Buffer 实际字节数计算
        ttl: IMAGE_CACHE_EXPIRE_TIME,  // 统一过期时间：24小时
    });

    const getSearchCacheKey = (keyword: string) => normalizeSearchText(keyword);
    const getImageProxyUrl = (url: string) => `/api/bilibiliImage?url=${encodeURIComponent(url)}`;
    const SEARCH_CATALOG_KEY = 'global';

    const getSearchClickCounts = async (items: BilibiliSearchVideo[]) => {
        const bvids = [...new Set(items.map(item => item.bvid).filter(Boolean))];
        if (bvids.length === 0) return {};

        const counts = await storage.getMany<number>(SEARCH_CLICK_NAMESPACE, bvids);
        return bvids.reduce<Record<string, number>>((acc, bvid) => {
            acc[bvid] = Number(counts[bvid]) || 0;
            return acc;
        }, {});
    };

    const getSearchCatalog = async () => {
        return (await storage.get<BilibiliSearchVideo[]>(SEARCH_CATALOG_NAMESPACE, SEARCH_CATALOG_KEY)) || [];
    };

    const saveSearchCatalog = async (items: BilibiliSearchVideo[]) => {
        await storage.set(SEARCH_CATALOG_NAMESPACE, SEARCH_CATALOG_KEY, items, SEARCH_CATALOG_EXPIRE_TIME);
    };

    const attachProxyImage = (items: BilibiliSearchVideo[]) => {
        return items.map(item => ({
            ...item,
            picProxy: ENABLE_BILIBILI_IMAGE_PROXY && item.pic ? getImageProxyUrl(item.pic) : undefined
        }));
    };

    // 检测并清理缓存
    const cacheCleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const roomId in roomOpCache) {
            roomOpCache[roomId] = roomOpCache[roomId].filter(log => now - log.timestamp < CACHE_OP_EXPIRE_TIME);
            if (!roomOpCache[roomId]?.length) {
                delete roomOpCache[roomId];
                delete roomSongsCache[roomId];
            }
        }
    }, CACHE_OP_EXPIRE_TIME);

    (app as any).closeAll = () => {
        clearInterval(cacheCleanupTimer);
    };

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
        ctx.websocket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                // 识别心跳消息
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) { }
        });
        ctx.websocket.on('error', (err) => console.error('WS Error Details:', err));
        ctx.websocket.on('close', (code, reason) => console.log('Closed with:', code, reason));
    });


    // 获取歌曲列表及当前哈希
    router.get('/api/songListInfo', async (koaCtx) => {
        const { roomId: roomIds, lastHash: clientHashs } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const clientHash = Array.isArray(clientHashs) ? clientHashs.at(0) : clientHashs;
        ktvLogger.debug('get: ', roomId, clientHash)
        // 初始化歌曲缓存
        if (!roomSongsCache[roomId])
            roomSongsCache[roomId] = await songListTools.initSongLists(storage, roomId);


        const currentSongLists = roomSongsCache[roomId];
        const serverHash = getHash(currentSongLists);

        // clientHash 为空或不匹配时
        if (clientHash && clientHash === serverHash) {
            return koaCtx.body = { changed: false, hash: serverHash };
        }

        koaCtx.body = {
            changed: true,
            list: currentSongLists,
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

        const allSongLists = roomSongsCache[roomId];
        const pendingSongs = [...allSongLists.queued];

        // 仅对未唱歌曲进行 Fisher-Yates Shuffle
        for (let i = pendingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pendingSongs[i], pendingSongs[j]] = [pendingSongs[j], pendingSongs[i]];
        }

        const finalSongLists: SongLists = {
            ...allSongLists,
            queued: pendingSongs
        };

        // 重置缓存
        roomSongsCache[roomId] = finalSongLists;
        roomOpCache[roomId] = [];
        await storage.set(DATABASE_NAME, roomId, finalSongLists, CACHE_EXPIRE_TIME);
        const finalHash = getHash(finalSongLists);
        koaCtx.body = { success: true, hash: finalHash };
        notifyUpdate(roomId, finalHash)
    });

    // 切歌接口 (下一首)
    router.post('/api/nextSong', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const { idArrayHash } = koaCtx.request.body as { idArrayHash: string };
        ktvLogger.debug('nextSong: ', roomId, idArrayHash)

        if (!roomSongsCache[roomId])
            roomSongsCache[roomId] = await songListTools.initSongLists(storage, roomId);

        const currentSongLists = roomSongsCache[roomId];
        const currentQueue = currentSongLists.queued;

        if (!currentQueue?.length) {
            // 队列为空：如果有正在唱的歌，把它放到已唱（避免重复）并清空 singing
            if (currentSongLists.singing) {
                if (!currentSongLists.sung.length || currentSongLists.sung[currentSongLists.sung.length - 1].id !== currentSongLists.singing.id) {
                    currentSongLists.sung.push(currentSongLists.singing);
                }
                const finishedSong = currentSongLists.singing;
                currentSongLists.singing = null;
                const finalHash = getHash(roomSongsCache[roomId]);
                await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
                koaCtx.body = { success: true, hash: finalHash, song: finishedSong };
                notifyUpdate(roomId, finalHash);
                return;
            }
            return koaCtx.body = { success: false, msg: '队列中没有待唱歌曲' };
        }

        // 把他从待唱列表中删除
        const toIndex = -1;

        const serverHash = getHash(currentSongLists);
        const nowIdArray = currentQueue.map(s => s.id);
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

        const baseIdArray = latest ? nowIdArray : [...logs[hitIdx].baseIdArray];
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];
        // 找第一首待唱歌曲
        const nextSong = currentQueue.find(s => s.id === baseIdArray[0]);
        if (!nextSong) return koaCtx.body = { success: false, code: 'REJECT' };
        const currentOp: OpLog = {
            baseIdArray: baseIdArray,
            baseHash: idArrayHash,
            song: nextSong,
            toIndex: toIndex,
            timestamp: Date.now()
        };
        ktvLogger.trace('nextSong OP: ', roomId, currentOp);
        try {
            const finalQueuedSongs = songOperation([...currentQueue], baseIdArray, laterOps, currentOp);
            logs.push(currentOp);
            if (logs.length > 50) logs.shift();
            roomOpCache[roomId] = logs;
            roomSongsCache[roomId].queued = finalQueuedSongs;
            // 把singing的歌曲放到sung, 把nextSong放到singing
            // 为了避免重复添加，检查id是否为nextSong，如果已经是了就不添加
            if (currentSongLists.singing && currentSongLists.singing.id !== nextSong.id) {
                currentSongLists.sung.push(currentSongLists.singing);
            }
            currentSongLists.singing = nextSong;

            const finalHash = getHash(roomSongsCache[roomId]);
            await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash };
            notifyUpdate(roomId, finalHash)
        } catch (e) {
            ktvLogger.debug('REJECT')
            koaCtx.body = { success: false, code: 'REJECT' };
        }
    });

    // 切回上一首 (上一首)
    router.post('/api/prevSong', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const { idArrayHash } = koaCtx.request.body as { idArrayHash: string };
        ktvLogger.debug('prevSong: ', roomId, idArrayHash)

        if (!roomSongsCache[roomId])
            roomSongsCache[roomId] = await songListTools.initSongLists(storage, roomId);

        const currentSongLists = roomSongsCache[roomId];
        const currentQueue = currentSongLists.queued;

        const serverHash = getHash(currentSongLists);
        const nowIdArray = currentQueue.map(s => s.id);
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

        const baseIdArray = latest ? nowIdArray : [...logs[hitIdx].baseIdArray];
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];

        if (!currentSongLists.sung?.length) {
            if (currentSongLists.singing) {
                // 把正在唱的歌放到队列头（通过 songOperation，记录到 OpLog）
                const currentSinging = currentSongLists.singing as Song;
                const currentOp: OpLog = {
                    baseIdArray: baseIdArray,
                    baseHash: idArrayHash,
                    song: currentSinging,
                    toIndex: 0,
                    timestamp: Date.now()
                };
                const finalQueuedSongs = songOperation([...currentQueue], baseIdArray, laterOps, currentOp);
                logs.push(currentOp);
                if (logs.length > 50) logs.shift();
                roomOpCache[roomId] = logs;
                roomSongsCache[roomId].queued = finalQueuedSongs;

                currentSongLists.singing = null;
                const finalHash = getHash(roomSongsCache[roomId]);
                await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
                koaCtx.body = { success: true, hash: finalHash };
                notifyUpdate(roomId, finalHash);
                return;
            }
            return koaCtx.body = { success: false, msg: '没有上一首可返回' };
        }

        const prevSong = currentSongLists.sung[currentSongLists.sung.length - 1];
        const currentSinging = currentSongLists.singing;

        // 如果 currentSinging 与 prevSong 相同，直接移出 sung 并返回（避免重复操作/插入队列）
        if (currentSinging && currentSinging.id === prevSong.id) {
            const lastIdx = currentSongLists.sung.findIndex(s => s.id === prevSong.id);
            if (lastIdx !== -1) currentSongLists.sung.splice(lastIdx, 1);
            // singing already equals prevSong, 不改变 queued
            const finalHash = getHash(roomSongsCache[roomId]);
            await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash, song: prevSong };
            notifyUpdate(roomId, finalHash);
            return;
        }

        // 如果有正在唱的歌，则构造 OpLog 将其移回队列头
        const currentOp: OpLog | null = currentSinging ? {
            baseIdArray: baseIdArray,
            baseHash: idArrayHash,
            song: currentSinging,
            toIndex: 0,
            timestamp: Date.now()
        } : null;

        try {
            const finalQueuedSongs = currentOp ? songOperation([...currentQueue], baseIdArray, laterOps, currentOp) : [...currentQueue];
            if (currentOp) {
                logs.push(currentOp);
                if (logs.length > 50) logs.shift();
                roomOpCache[roomId] = logs;
                roomSongsCache[roomId].queued = finalQueuedSongs;
            }
            // 把 prevSong 从 sung 移出并设为 singing（避免重复）
            const lastIdx = currentSongLists.sung.findIndex(s => s.id === prevSong.id);
            if (lastIdx !== -1) currentSongLists.sung.splice(lastIdx, 1);

            if (currentSongLists.singing && currentSongLists.singing.id === prevSong.id) {
                // already singing; do nothing
            } else {
                currentSongLists.singing = prevSong;
            }

            const finalHash = getHash(roomSongsCache[roomId]);
            await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash, song: prevSong };
            notifyUpdate(roomId, finalHash)
        } catch (e) {
            ktvLogger.debug('REJECT')
            koaCtx.body = { success: false, code: 'REJECT' };
        }
    });

    // 把已唱歌曲撤回到待唱顶部
    router.post('/api/undoSung', async (koaCtx) => {
        const { roomId: roomIds } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const { idArrayHash, songId } = koaCtx.request.body as { idArrayHash: string, songId?: string };
        ktvLogger.debug('undoSung: ', roomId, idArrayHash, songId)

        if (!roomSongsCache[roomId])
            roomSongsCache[roomId] = await songListTools.initSongLists(storage, roomId);

        const currentSongLists = roomSongsCache[roomId];
        const currentQueue = currentSongLists.queued;

        const serverHash = getHash(currentSongLists);
        const nowIdArray = currentQueue.map(s => s.id);
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

        const baseIdArray = latest ? nowIdArray : [...logs[hitIdx].baseIdArray];
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];

        // 找到目标已唱歌曲
        let targetSong = songId ? currentSongLists.sung.find(s => s.id === songId) : undefined;
        // 如果未指定 songId，则默认取最后一首已唱
        if (!targetSong && currentSongLists.sung.length > 0) {
            targetSong = currentSongLists.sung[currentSongLists.sung.length - 1];
        }

        if (!targetSong) return koaCtx.body = { success: false, msg: '未找到已唱歌曲' };

        // 如果已在队列中，则直接从 sung 中移除并返回
        if (currentQueue.some(s => s.id === targetSong.id)) {
            const idx = currentSongLists.sung.findIndex(s => s.id === targetSong.id);
            if (idx !== -1) currentSongLists.sung.splice(idx, 1);
            const finalHash = getHash(roomSongsCache[roomId]);
            await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash };
            notifyUpdate(roomId, finalHash);
            return;
        }

        const currentOp: OpLog = {
            baseIdArray: baseIdArray,
            baseHash: idArrayHash,
            song: targetSong,
            toIndex: 0,
            timestamp: Date.now()
        };

        try {
            const finalQueuedSongs = songOperation([...currentQueue], baseIdArray, laterOps, currentOp);
            logs.push(currentOp);
            if (logs.length > 50) logs.shift();
            roomOpCache[roomId] = logs;
            roomSongsCache[roomId].queued = finalQueuedSongs;

            // 从 sung 中移除
            const lastIdx = currentSongLists.sung.findIndex(s => s.id === targetSong.id);
            if (lastIdx !== -1) currentSongLists.sung.splice(lastIdx, 1);

            const finalHash = getHash(roomSongsCache[roomId]);
            await storage.set(DATABASE_NAME, roomId, roomSongsCache[roomId], CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash, song: targetSong };
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
        if (link && !link.startsWith('bilibili://') && (link.includes('b23.tv') || link.includes('bilibili.com') || link.match(/BV[a-zA-Z0-9]{10}/i))) {
            const biliData = await resolveBilibiliData(link);
            if (biliData) {
                // 更新 URL
                link = biliData.url;
            }
        }
        koaCtx.body = { success: true, link };
    });

    router.get('/api/bilibiliSearch', async (koaCtx) => {
        const { keyword: keywords } = koaCtx.query;
        const keyword = Array.isArray(keywords) ? keywords.at(0) : keywords;
        if (!keyword?.trim()) {
            koaCtx.body = { success: true, items: [] };
            return;
        }

        try {
            const cacheKey = getSearchCacheKey(keyword);
            const catalog = await getSearchCatalog();
            const catalogClickCounts = await getSearchClickCounts(catalog);
            const localMatches = filterCachedBilibiliSearchVideos(catalog, keyword, catalogClickCounts);
            ktvLogger.info(`[Search] keyword="${keyword}" cacheKey="${cacheKey}" catalog=${catalog.length} localMatches=${localMatches.length}`);

            let items: BilibiliSearchVideo[] = localMatches.slice(0, 20);

            if (items.length < 8) {
                let remoteOrExact = await storage.get<BilibiliSearchVideo[]>(SEARCH_CACHE_NAMESPACE, cacheKey);
                const fromSearchCache = !!remoteOrExact?.length;
                if (!remoteOrExact?.length) {
                    ktvLogger.info(`[Search] calling Bilibili API for "${keyword}"`);
                    const { items: rawItems, directBvids } = await searchBilibiliKtvVideos(keyword);
                    const beforeFilter = rawItems.length;
                    remoteOrExact = filterBilibiliSearchVideosByRelevance(rawItems, keyword, directBvids);
                    ktvLogger.info(`[Search] API raw=${beforeFilter} direct=${directBvids.size} after-filter=${remoteOrExact.length}`);
                    await fetchBilibiliVideoParts(remoteOrExact);
                    await storage.set(SEARCH_CACHE_NAMESPACE, cacheKey, remoteOrExact, SEARCH_CACHE_EXPIRE_TIME);
                } else {
                    ktvLogger.info(`[Search] search-cache hit for "${cacheKey}" items=${remoteOrExact.length}`);
                }

                /*TODO
                    /api/bilibiliSearch 在缓存回写时会把 mergedCatalog 整体写回 Redis，
                    但没有任何上限或裁剪逻辑（mergeBilibiliSearchVideos(catalog, remoteOrExact) 会持续累加）。
                    在搜索频繁/关键词多的情况下，这个全局目录可能无限增长，
                    导致 Redis 单 key 体积膨胀、getSearchClickCounts(mergedCatalog) 的 mget 变大、
                    以及每次请求合并/排序的 CPU 开销上升。
                    建议在写入前对 catalog 做容量控制
                    （例如只保留 Top-N 的高分/高点击/有优先 tag 的条目，或按时间/点击做淘汰），
                    并避免对超大 catalog 做全量 clickCounts 拉取。
                 */
                const mergedCatalog = mergeBilibiliSearchVideos(catalog, remoteOrExact);
                await saveSearchCatalog(mergedCatalog);

                const mergedClickCounts = await getSearchClickCounts(mergedCatalog);
                const refreshedLocalMatches = filterCachedBilibiliSearchVideos(mergedCatalog, keyword, mergedClickCounts);
                const remoteSorted = sortBilibiliSearchVideos(remoteOrExact, keyword, mergedClickCounts);
                items = mergeBilibiliSearchVideos(refreshedLocalMatches, remoteSorted).slice(0, 20);
                ktvLogger.info(`[Search] fromSearchCache=${fromSearchCache} refreshedLocalMatches=${refreshedLocalMatches.length} remoteSorted=${remoteSorted.length} finalItems=${items.length}`);
            } else {
                ktvLogger.info(`[Search] catalog-only path items=${items.length}`);
            }

            const clickCounts = await getSearchClickCounts(items);
            const sortedItems = sortBilibiliSearchVideos(items, keyword, clickCounts);
            ktvLogger.info(`[Search] returning ${sortedItems.length} items for "${keyword}"`);
            koaCtx.body = {
                success: true,
                keyword: normalizeSearchText(keyword),
                items: attachProxyImage(sortedItems)
            };
        } catch (error) {
            ktvLogger.error('Bilibili search failed', error);
            koaCtx.status = 500;
            koaCtx.body = {
                success: false,
                msg: error instanceof Error ? error.message : 'Bilibili search failed'
            };
        }
    });

    router.post('/api/bilibiliSearch/select', async (koaCtx) => {
        const { bvid } = koaCtx.request.body as { bvid?: string };
        if (!bvid) {
            koaCtx.body = { success: false, msg: 'Missing bvid' };
            return;
        } else if (!BVID_REGEX.test(bvid)) {
            koaCtx.body = { success: false, msg: 'Invalid bvid' };
            return;
        }

        const updated = await storage.increment(SEARCH_CLICK_NAMESPACE, bvid, SEARCH_CLICK_TTL_MS);
        if (typeof updated !== 'number') {
            koaCtx.status = 503;
            koaCtx.body = { success: false, msg: 'Click counter unavailable' };
            return;
        }
        koaCtx.body = { success: true };
    });

    router.get('/api/bilibiliImage', async (koaCtx) => {
        if (!ENABLE_BILIBILI_IMAGE_PROXY) {
            koaCtx.status = 500;
            koaCtx.body = {
                success: false,
                msg: 'Image proxy is disabled'
            };
            return;
        }
        const { url: urls } = koaCtx.query;
        const imageUrl = Array.isArray(urls) ? urls.at(0) : urls;
        if (!imageUrl) {
            koaCtx.status = 400;
            koaCtx.body = 'Missing url';
            return;
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(imageUrl);
        } catch {
            koaCtx.status = 400;
            koaCtx.body = 'Invalid url';
            return;
        }

        if (parsedUrl.protocol !== 'https:') {
            koaCtx.status = 403;
            koaCtx.body = 'Forbidden protocol';
            return;
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        if (!(hostname === 'hdslb.com' || hostname.endsWith('.hdslb.com'))) {
            koaCtx.status = 403;
            koaCtx.body = 'Forbidden host';
            return;
        }

        const cached = imageCache.get(imageUrl);
        if (cached) {
            koaCtx.set('Content-Type', cached.contentType);
            koaCtx.set('Cache-Control', 'public, max-age=86400');
            koaCtx.body = cached.buffer;
            return;
        }

        try {
            const response = await axios.get<ArrayBuffer>(imageUrl, {
                responseType: 'arraybuffer',
                timeout: IMAGE_PROXY_TIMEOUT_MS,
                maxContentLength: IMAGE_PROXY_MAX_BYTES,
                maxBodyLength: IMAGE_PROXY_MAX_BYTES,
                validateStatus: (status) => status >= 200 && status < 300,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bilibili.com/'
                }
            });
            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || 'image/jpeg';
            if (!contentType.startsWith('image/')) {
                koaCtx.status = 502;
                koaCtx.body = 'Image fetch failed';
                return;
            }
            imageCache.set(imageUrl, {
                buffer,
                contentType,
            });
            koaCtx.set('Content-Type', contentType);
            koaCtx.set('Cache-Control', 'public, max-age=86400');
            koaCtx.body = buffer;
        } catch (error) {
            ktvLogger.warn('Bilibili image proxy failed', imageUrl, error instanceof Error ? error.message : error);
            koaCtx.status = 502;
            koaCtx.body = 'Image fetch failed';
        }
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

        // 如果是 B 站链接
        if (song && song.url && !song.url.startsWith('bilibili://') && (song.url.includes('b23.tv') || song.url.includes('bilibili.com') || song.url.match(/BV[a-zA-Z0-9]{10}/i))) {
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
        if (!roomSongsCache[roomId])
            roomSongsCache[roomId] = await songListTools.initSongLists(storage, roomId);

        const allSongLists = roomSongsCache[roomId];
        const queueSongList = [...allSongLists.queued];
        const serverHash = getHash(allSongLists);
        const alreadyHad = allSongLists.queued.some(s => s.id === song.id)

        const currentOp: OpLog = {
            // 这是提前配置好了操作
            baseIdArray: queueSongList.map(s => s.id),
            baseHash: serverHash,
            song: song,
            // 这里的toIndex不是变基后的，songOperation函数内会自动修正
            toIndex: toIndex >= queueSongList?.length ? queueSongList.length - (alreadyHad ? 1 : 0) : toIndex,
            timestamp: Date.now()
        };


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
        ktvLogger.trace('server queued song lists:', queueSongList.map(s => s.id));
        ktvLogger.trace(song?.title, 'FIND INDEX:', { hitIdx, latest, serverHash, logsLength: logs?.length })

        // REJECT 逻辑：如果前端传来的 Hash 在日志里找不到
        // 可能是因为服务器重启导致 Log 丢失，或者前端落后太多
        if (!latest && hitIdx === -1) {
            ktvLogger.debug('REJECT')
            return koaCtx.body = { success: false, code: 'REJECT' };
        }

        const baseLog = logs.at(hitIdx);
        const baseIdArray = latest ? queueSongList.map(s => s.id) : [...baseLog.baseIdArray];
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];

        try {
            // 执行重演逻辑
            const tempSongList = songOperation(queueSongList, baseIdArray, laterOps, currentOp);
            const finalSongLists = { ...allSongLists, queued: tempSongList };
            const finalHash = getHash(finalSongLists);
            ktvLogger.debug('new hash:', finalHash);
            logs.push(currentOp);

            if (logs.length > 50) logs.shift();

            roomSongsCache[roomId] = finalSongLists;
            roomOpCache[roomId] = logs;
            await storage.set(DATABASE_NAME, roomId, finalSongLists, CACHE_EXPIRE_TIME);
            koaCtx.body = { success: true, hash: finalHash, song };
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
    return {
        app,
        close: () => {
            clearInterval(cacheCleanupTimer);
        }
    };
}
