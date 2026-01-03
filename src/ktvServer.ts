import path from "node:path";
import fs from "node:fs";
import ejs from 'ejs';
import ktvLogger from "@/logger";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from 'koa-bodyparser';
import { Storage } from "@/storage";
import { getHash, resolveBilibiliData, songOperation } from "@/utils";
import { OpLog, Song, SongOperationBody } from "@/types";


const DATABASE_NAME = "ktv_room" as const;

export function runKTVServer(staticDir: string, redisUrl?: string) {
    const app = new Koa();
    const router = new Router();
    app.use(bodyParser());

    const DEFAULT_CACHE_DATA_EXPIRE_TIME = 24 * 60 * 60 * 1000;
    const DEFAULT_CACHE_OP_EXPIRE_TIME = 5 * 60 * 1000;

    // 预读模板文件
    const templatePath = path.resolve(staticDir,'./songRoom.ejs')
    let templateStr = fs.readFileSync(templatePath, 'utf-8')
    ktvLogger.info('loaded songRoom.ejs')
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

        koaCtx.body = { success: true, hash: getHash(finalSongs) };
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
        } catch (e) {
            ktvLogger.debug('REJECT')
            koaCtx.body = { success: false, code: 'REJECT' };
        }
    });

    // Move/Add/Delete 逻辑
    router.post('/api/songOperation', async (koaCtx) => {
        const { roomId: roomIds} = koaCtx.query;
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
        if (song && song.url && (song.url.includes('b23.tv') || song.url.includes('bilibili.com'))) {
            const biliData = await resolveBilibiliData(song.url);
            if (biliData) {
                // 更新 URL
                song.url = biliData.url;
                if (!song.title) {
                    song.title = `${song.title}${biliData.pNum?`(p${biliData.pNum})`:''}`;
                }
            }
        }

        // 确保缓存存在，防止服务器重启后第一个请求是 POST 导致报错
        if (!roomSongsCache[roomId]) {
            roomSongsCache[roomId] = (await storage.get<Song[]>(DATABASE_NAME, roomId) || []);
        }
        const allSongs = [...roomSongsCache[roomId]];
        const waitingLength = allSongs.filter(s=>s.state!=='sung').length;
        const serverHash = getHash(allSongs);
        const alreadyHad = allSongs.some(s=>s.id===song.id)


        const currentOp: OpLog = {
            // 这是提前配置好了变基后的数据
            baseIdArray: allSongs.map(s=>s.id),
            baseHash: serverHash,
            song: song,
            // 这里的toIndex不是变基后的，songOperation函数内会自动修正
            toIndex: toIndex >= waitingLength ? allSongs.length - (alreadyHad?1:0) : toIndex,
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

        const baseLog =  logs.at(hitIdx);
        const baseIdArray = latest ? allSongs.map(s=>s.id) : [...baseLog.baseIdArray];
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
        } catch (e) {
            ktvLogger.error("Operation re-run failed:", e);
            koaCtx.body = { success: false, code: 'REJECT' };
            ktvLogger.debug('REJECT')
        }
    });

    // WebUI 托管
    router.get('/:roomId', async (koaCtx) => {
        if (process.env.NODE_ENV === "development") {
            ktvLogger.info('loading template')
            // const templatePath = path.resolve(__dirname, '../static/songRoom.ejs')
            templateStr = fs.readFileSync(templatePath, 'utf-8')
        }
        const { roomId } = koaCtx.params
        const urlPath = koaCtx.path;
        // 检查路径末尾是否有斜杠
        if (urlPath.endsWith('/')) {
            koaCtx.status = 301;
            // 删除斜杠并保留 query 参数
            koaCtx.redirect(urlPath.slice(0,-1) + koaCtx.search);
            return;
        }
        // 使用 EJS
        const html = ejs.render(templateStr, {
            roomId,
            pageTitle: `KTV 房间 - ${roomId}`
        })
        koaCtx.type = 'html'
        koaCtx.body = html
    })

    // 默认入口页面：输入房间号
    router.get('/', async (koaCtx) => {
        koaCtx.type = 'html';
        const urlPath = koaCtx.path;
        // 检查路径末尾是否有斜杠
        if (!urlPath.endsWith('/')) {
            koaCtx.status = 301;
            // 加上斜杠并保留 query 参数
            koaCtx.redirect(urlPath + '/' + koaCtx.search);
            return;
        }
        koaCtx.body = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>进入 KTV 房间</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-pop { animation: slideUp 0.5s ease-out; }
        </style>
    </head>
    <body class="bg-slate-50 min-h-screen flex items-center justify-center p-6 text-slate-900">
        <div class="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-pop">
            <header class="text-center mb-8">
                <h1 class="text-4xl font-black text-indigo-600 mb-2">KTV Queue</h1>
                <p class="text-slate-400 font-medium">输入房间号进入房间</p>
            </header>

            <div class="space-y-4">
                <input id="roomInput" type="text" maxlength="10"
                    class="w-full px-6 py-4 bg-slate-50 rounded-2xl text-center text-2xl font-bold tracking-widest outline-none focus:ring-4 focus:ring-indigo-100 transition-all border-2 border-transparent focus:border-indigo-400"
                    placeholder="0000" autofocus>

                <button onclick="joinRoom()"
                    class="w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100">
                    进入房间
                </button>
            </div>

            <div class="mt-8 flex flex-col items-center gap-4">
                <div class="flex items-center gap-4">
                    <a href="https://github.com/birchtree2/ktv-song-web" target="_blank" class="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        <span class="text-sm font-bold">GitHub</span>
                    </a>
                    <iframe src="https://ghbtns.com/github-btn.html?user=birchtree2&repo=ktv-song-web&type=star&count=true" frameborder="0" scrolling="0" width="100" height="20" title="GitHub"></iframe>
                </div>
                <p class="text-slate-300 text-[10px] uppercase tracking-widest font-bold">Powered by StarFreedomX</p>
            </div>
        </div>

        <script>
            function joinRoom() {
                const id = document.getElementById('roomInput').value.trim();
                if (id) window.location.href = id;
            }

            // 支持回车键跳转
            document.getElementById('roomInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') joinRoom();
            });
        </script>
    </body>
    </html>
    `;
    });

    app.use(router.routes()).use(router.allowedMethods());

    // 返回 app
    return app;
}

