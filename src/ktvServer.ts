import path from "node:path";
import fs from "node:fs";
import ejs from 'ejs';
import * as crypto from 'crypto';
import ktvLogger from "@/logger";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from 'koa-bodyparser';
import { Storage } from "@/storage";
import axios from "axios";

const app = new Koa();
const router = new Router();
app.use(bodyParser());
interface Song {
    id: string
    title: string
    url: string
}

interface SongOperationBody {
    idArrayHash: string;
    song: Song;
    toIndex: number;
}

interface OpLog {
    baseIdArray: string[]   // 操作前的数组
    baseHash: string
    song: Song
    toIndex: number
    timestamp: number
}




export function runKTVServer(staticDir: string, redisUrl?: string) {
    // 预读模板文件
    const templatePath = path.resolve(staticDir,'./songRoom.ejs')
    let templateStr = fs.readFileSync(templatePath, 'utf-8')
    ktvLogger.info('loaded songRoom.ejs')
    const storage = new Storage(redisUrl);

    // 校验 roomId
    const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;
    const CACHE_EXPIRE_TIME = Number(process.env.CACHE_DATA_EXPIRE_TIME) || 24 * 60 * 60 * 1000;

    // 缓存变量，按 roomId 分隔
    const roomOpCache: Record<string, OpLog[]> = {}
    const roomSongsCache: Record<string, Song[]> = {}

    // 生成哈希工具函数
    function getHash(songs: Song[]) {
        if (!songs || songs.length === 0) return "EMPTY_LIST_HASH"; // 给空列表一个固定标识
        const str = songs.map(s => `${s.id}:${s.title}:${s.url}`).join('|');
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    // 每 5 分钟检测并清理 5 分钟前的缓存
    setInterval(() => {
        const now = Date.now();
        for (const roomId in roomOpCache) {
            roomOpCache[roomId] = roomOpCache[roomId].filter(log => now - log.timestamp < 5 * 60 * 1000);
            if (!roomOpCache[roomId]?.length) {
                delete roomOpCache[roomId];
                delete roomSongsCache[roomId];
            }
        }
    }, Number(process.env.CACHE_OP_EXPIRE_TIME) || 5 * 60 * 1000);


    // 获取歌曲列表及当前哈希
    router.get('/api/songListInfo', async (koaCtx) => {
        const { roomId: roomIds, lastHash: clientHashs } = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        const clientHash = Array.isArray(clientHashs) ? clientHashs.at(0) : clientHashs;
        ktvLogger.debug('get: ', roomId, clientHash)
        // 初始化歌曲缓存
        if (!roomSongsCache[roomId]) {
            const dbData = await storage.get<Song[]>('ktv_room', roomId);
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

    // Move/Add/Delete 逻辑
    router.post('/api/songOperation', async (koaCtx) => {
        const { roomId: roomIds} = koaCtx.query;
        const roomId = Array.isArray(roomIds) ? roomIds.at(0) : roomIds;
        if (!ROOM_ID_REGEX.test(roomId)) {
            return koaCtx.body = { success: false, msg: 'Invalid Room ID' };
        }
        const body = koaCtx.request.body as SongOperationBody;
        const { idArrayHash, song, toIndex } = body;
        ktvLogger.debug('post: ', roomId, ' base on ', idArrayHash, 'put', song, 'to', toIndex);
        ktvLogger.debug(song.title,'POST AT:', Date.now())

        if (song && song.url && song.url.includes('b23.tv')) {
            const bvid = await resolveBilibiliBV(song.url);
            if (bvid) {
                // 将 url 替换为提取出的 BV 号（或者完整的 bilibili:// 协议）
                song.url = `bilibili://video/${bvid}`;
                if (!song.id) song.id = bvid;
            }
        }

        // 确保缓存存在，防止服务器重启后第一个请求是 POST 导致报错
        if (!roomSongsCache[roomId]) {
            roomSongsCache[roomId] = (await storage.get<Song[]>('ktv_room', roomId) || []);
        }

        const currentSongs = roomSongsCache[roomId];
        const serverHash = getHash(currentSongs);


        const nowSongs = [...roomSongsCache[roomId]];

        const currentOp: OpLog = {
            // 这是提前配置好了变基后的数据
            baseIdArray: nowSongs.map(s=>s.id),
            baseHash: serverHash,
            song: song,
            // 这里的toIndex不是变基后的，songOperation函数内会自动修正
            toIndex: toIndex,
            timestamp: Date.now()
        };
        ktvLogger.debug(song.title,'BUILD AT:', Date.now())


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
        ktvLogger.debug(song.title,'FIND INDEX AT:', Date.now(), { hitIdx, latest, idArrayHash, logsLength: logs.length })

        // REJECT 逻辑：如果前端传来的 Hash 在日志里找不到
        // 可能是因为服务器重启导致 Log 丢失，或者前端落后太多
        if (!latest && hitIdx === -1) {
            return koaCtx.body = { success: false, code: 'REJECT' };
        }

        const baseLog =  logs.at(hitIdx);
        const baseIdArray = latest ? nowSongs.map(s=>s.id) : [...baseLog.baseIdArray];
        ktvLogger.debug(song.title,'BASE ARRAY AT:', Date.now())
        const laterOps = latest ? [] : [...logs.slice(hitIdx)];
        ktvLogger.debug(song.title,'LATER OPS AT:', Date.now())

        try {
            // 执行重演逻辑
            ktvLogger.debug(currentOp.song.title,'IN AT:', Date.now())
            const finalSongs = songOperation(nowSongs, baseIdArray, laterOps, currentOp);
            ktvLogger.debug(currentOp.song.title,'OUT AT:', Date.now())
            const finalHash = getHash(finalSongs);
            logs.push(currentOp);
            ktvLogger.debug(currentOp.song.title,'PUSH AT:', Date.now())


            // 保持日志长度，防止内存溢出（只保留最近 50 条操作记录）
            if (logs.length > 50) logs.shift();

            roomSongsCache[roomId] = finalSongs;
            roomOpCache[roomId] = logs;
            ktvLogger.debug(currentOp.song.title,'SYNC AT:', Date.now())
            await storage.set('ktv_room', roomId, finalSongs, CACHE_EXPIRE_TIME);;
            ktvLogger.debug(currentOp.song.title,'CACHE AT:', Date.now())
            koaCtx.body = { success: true, hash: finalHash, song };
        } catch (e) {
            ktvLogger.error("Operation re-run failed:", e);
            koaCtx.body = { success: false, code: 'REJECT' };
        }
    });

    /**
     * 解析 B23.TV 短链接并提取 BV 号
     * @param {string} inputUrl
     * @returns {Promise<string|null>} 返回提取到的 BV 号
     */
    async function resolveBilibiliBV(inputUrl: string): Promise<string> {
        // 基础校验：必须是 b23.tv 的链接
        if (!inputUrl.includes('b23.tv')) {
            // 如果输入已经是原始链接，直接尝试从输入提取
            return extractBV(inputUrl);
        }
        try {
            // 发起请求，禁止自动重定向
            const response = await axios(inputUrl, {
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/004.1'
                }
            });

            const targetUrl = response.headers['location'];

            return extractBV(targetUrl);

        } catch (error) {
            const loc = error.response?.headers?.location;
            if (loc) return extractBV(loc);

            ktvLogger.warn('解析 B23 短链接失败:', error.message);
            return null;
        }
    }

    /**
     * 正则提取 BV 号
     */
    function extractBV(url: string) {
        if (!url) return null;
        const match = url.match(/(BV[a-zA-Z0-9]{10})/);
        return match ? match[0] : null;
    }

    /**
     * 对歌曲进行变基操作，并返回最新歌曲列表顺序
     * @param nowSongs  后端当前歌曲集合
     * @param baseSongIdArray   base歌曲排列顺序
     * @param ops   后端从base开始执行的操作(不包括生成base)
     * @param nowOp 当前操作(基于base baseSongIdArray)
     */
    function songOperation(nowSongs: Song[], baseSongIdArray: string[], ops: OpLog[], nowOp: OpLog): Song[] {
        ktvLogger.debug({ baseSongIdArray, ops, nowOp })
        /*
        实现逻辑：首先构造双向链表
        HEAD <-> 0 <-> A <-> 1 <-> B <-> 2 <-> C <-> 3 <-> D <-> 4 <-> E <-> 5 <-> F <-> 6 <-> G <-> 7
        对于接下来的Ops采用双向链表操作实现
        op1: A -> 4
        op2: B -> 6
        ...
        那么将很简单，让 A 的前后元素相连变为 0 <-> 1
        然后把prev(4) <-> 4 改为 prev(4) <-> A <-> 4 ......
        以此类推

        我们用S_0(x_0,x_1,...)称作基于S_0标尺实施的一系列操作x_0,x_1,.....
        那么其本质上为一个有向无环图
        即假设服务器接受到了基于S_0的两个操作x_1,x_2
        可以发现基于S_0出现了两个"分支"

        S_0----[接收到S_0(x_1)]---S_0(x_0,x_1)--->S_1
                    ----[接收到S_0(x_2)]---S_0(x_0,x_1)---->S_2

        在x_2操作后，服务器回退到S_0并将x_1 x_2一并执行得到S_2
        此时，S_1将不是处于最新状态(已经废弃)

        此时若接收到基于S_1的操作x_3将会出现冲突

        S_0---S_0(x_1)-->S_1---S_1(x_3)--->?
         |---------S_0(x_1,x_2)-------->S_2

        为解决这个问题，我们需要引入变基操作
        把基于S_0的x_1=>x_2操作转换为基于S_1的x_2'操作
        S_0---S_0(x_1)-->S_1-----S_1(x_2')--------
         |                                       |
         |---------S_0(x_1,x_2)---------------->S_2

        如何进行？
        由于对S_0执行多个操作时，会基于S_0建立一套"标尺"
        如 0-A-1-B-2-C-3-D-4-E-5-F-6-G-7
        变基操作实际上就是
        当遇到回溯时，找出回溯的最后一个操作之后的操作
        依次对这些操作进行变基，把新生成的空位标尺和原来进行比对
        进行转换即可

        那么问题转化为只需解决下面的问题
        已知S_0(x_1)(x_2)(x_3)(x_4).....=S_n
        求S_0(_x_n+1)变基到S_n的操作(x_n+1)

        其中x_1 x_2等都是基于上一步的原子化操作
        因此无需使用标记直接移动即可

        我们在OpLog里存储每一步的数据和基于的数组

        首先第一步，打标
        HEAD-0-A-1-B-2-C-3-D-4-E-5-F-6-G-7-HEAD

        然后依次执行OpLog中的操作
        注意这里不用管链表的数字，只需要根据元素进行插入即可，因为每一步都是基于上一步的结果产生的操作
        也就是说 插入index 2 并不是插入到链表元素2在的位置，而是ABCDEFG中去除待排元素后排列第二个(index=2-1)的后面
        举个例子就是  HEAD-0-A-1-B-D-E-2-C-3-4-5-F-6-G-7-TAIL
        把A插入到index=4的意思就是，先把链表的歌曲元素弄出来得到BDECFG，
        然后A就知道自己要放到C(index=4-1)后面
        然后再进行链表操作放过去就行
        也就是C-3变成C-A-3,0-A-1变成0-1

        *其实也可以不用管链表
        因为每个op都存了当前操作和基础数组
        所以实际上重演逻辑的时候，拿到的数组一定是当前的基础数组
        那就可以
        若op[i]时为
        把A插入到index=4
        那就相当于
        把A插入到index=3之后
        也就是insert A after op[i].idArray.filter(id=>id!=A.id).at(3)
        特别地，操作为加入新元素时，会多形成一个空位，这正是所预期的
        操作为删除元素时，toIndex=-1，这时候直接删除


        比如
        INITIAL            S_0  HEAD-0-A-1-B-2-C-3-D-4-E-5-F-6-G-7
        INDEX OF ALPHABET           0  | 1 | 2 |   3   | 4 | 5 |6
        D to index 2       S_1  HEAD-0-A-1-B-D-2-C-3-4-E-5-F-6-G-7
        insert after A(1)           0  | 1 |2| 3 |    4    | 5 |6
        E to index 3       S_2  HEAD-0-A-1-B-D-E-2-C-3-4-5-F-6-G-7
        insert after D(2)           0  | 1 |2|3| 4 |   5   |  6
        G to index 0       S_3  HEAD-G-0-A-1-B-D-E-2-C-3-4-5-F-6-7
        insert after HEAD          0 |   1   |2|3| 4 |   5   | 6

        接下来执行变基
        A to index "2"
        =insert A to "2" in chain
        =insert A to  4  base on S_3 (G-(A)-B-D-E-   -C-F)
                                     0|  1  |2|3|  4  |5|6
        =insert A after index 3(E) HEAD-G-0-1-B-D-E-[A]-2-C-3-4-5-F-6-7-TAIL
        = G-B-D-E-A-C-F
        需要存入日志的内容:
        {
            array: G-A-B-D-E-C-F
            hash: hash(G-A-B-D-E-C-F)
            element: A
            toIndex: 5
            timestamp: now
        }




         */

        // 构建最新的 Song 状态池
        // 键为id，值为歌曲
        const latestSongMap = new Map<string, Song>();
        if (Array.isArray(nowSongs)) {
            nowSongs.forEach(s => s && s.id && latestSongMap.set(s.id, s));
        }

        // 把操作按照时间由远到近排序(时间戳升序)
        const sortedOps: OpLog[] = [...ops].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        [...sortedOps,nowOp].forEach(op => {
                if (op?.song?.id && op.toIndex !== -1) {
                    // 更新这段操作时的歌曲
                    latestSongMap.set(op.song.id, op.song);
                }
            });

        // 这样latestSongMap已经存有所有涉及到歌曲的最新状态

        // 构造双向链表，存储base时的空位
        class ListNode {
            val: string | number;
            prev: ListNode | null = null;
            next: ListNode | null = null;
            constructor(val: string | number) { this.val = val; }
        }

        const head = new ListNode('HEAD');
        let current = head;
        // 构建id->node的Map
        const idNodes = new Map<string, ListNode>();
        // 构建数字索引->node的Map
        const numberNodes = new Map<number, ListNode>();
        const maxNumber = (baseSongIdArray?.length || 0)
        // 遍历base数组，初始化
        for (let i = 0; i <= maxNumber; i++) {
            // 数字节点
            const numberNode = new ListNode(i);
            numberNodes.set(i, numberNode);
            // 和前一个相连
            [current.next,numberNode.prev] = [numberNode,current];
            // 移动当前指向

            current = numberNode;
            if (i < baseSongIdArray.length) {
                // 取出歌曲id
                const id = baseSongIdArray[i];
                if (id !== undefined && id !== null) {
                    const idNode = new ListNode(id);
                    // 加入Map
                    idNodes.set(id, idNode);
                    // 和前一个相连
                    [current.next,idNode.prev] = [idNode,current];
                    current = idNode;
                }
            }
        }
        // 到这里已经初始化完成
        // 接下来要处理ops[]
        for (let i = 0; i < sortedOps.length; i++) {
            const lastArray: string[] = sortedOps.at(i).baseIdArray;
            const toIndex: number = sortedOps.at(i).toIndex;
            const opId = sortedOps.at(i).song.id;
            let opNode = idNodes.get(opId);
            if (!opNode) {
                opNode = new ListNode(opId);
                idNodes.set(opId, opNode);
            }
            // 删除元素
            if (toIndex===-1){
                if (opNode.prev) opNode.prev.next = opNode.next;
                if (opNode.next) opNode.next.prev = opNode.prev;

                opNode.prev = opNode.next = null;
            }

            // 获取插入位置的前一个元素
            const toSongNext: ListNode = toIndex === 0
                ? head
                : idNodes.get(lastArray.filter(s=>s!==opId).at(toIndex-1));
            // 如果本身在链表中，先断开连接
            if(opNode.prev) opNode.prev.next = opNode.next;
            if(opNode.next) opNode.next.prev = opNode.prev;
            // 新连接
            [opNode.next, opNode.prev] = [toSongNext.next,toSongNext];
            [toSongNext.next.prev, toSongNext.next] = [opNode,opNode];

        }

        /* 现在我们要对nowOp中的索引换一种表达方式
        现在的toIndex表示的是插入后元素所在的位置
        我们需要转换成元素插入的空隙
        比如下面这个C
          0   1   2   3   4
        0 A 1 B 2 C 3 D 4 E 5
        0 | 1 |   2   | 3 | 4
        注意到，如果往前插，插入的数字就等于toIndex
        但是如果往后插，则插入的数字会大1
        特别地，如果是添加新元素，则不会有差别
          0   1   2   3   4
        0 A 1 B 2 C 3 D 4 E 5
        0 | 1 | 2 | 3 | 4 | 5
        也就是我们要检测baseArray中操作元素的位置，
        从而确定插入位置
        */

        const toIndex = nowOp.toIndex;
        const opId = nowOp.song.id
        const baseIndex = baseSongIdArray.indexOf(opId)
        const finalIndex = toIndex == -1 ? -1 :
            baseIndex === -1 || toIndex < baseIndex ? toIndex : toIndex + 1
        const insertNumberNode = numberNodes.get(finalIndex)




        let opNode = idNodes.get(opId);
        if (!opNode) {
            opNode = new ListNode(opId);
            idNodes.set(opId, opNode);
        }
        if (toIndex===-1){
            if (opNode.prev) opNode.prev.next = opNode.next;
            if (opNode.next) opNode.next.prev = opNode.prev;
            opNode.prev = opNode.next = null;
        }else {
            // 断开
            if (opNode.prev) opNode.prev.next = opNode.next;
            if (opNode.next) opNode.next.prev = opNode.prev;
            // 插入
            opNode.prev = insertNumberNode.prev;
            opNode.next = insertNumberNode;
            if (insertNumberNode.prev) insertNumberNode.prev.next = opNode
            insertNumberNode.prev = opNode;
            // 下面这种做法会导致以后读历史时出现数组下标越界
            // nowOp.toIndex = finalIndex;
            // ops应该记录的是正常插法(插完之后元素在数组的索引)
        }

        // 转换回数组
        const result: Song[] = [];
        let p: ListNode | null = head.next;

        while (p !== null) {
            if (typeof p.val === 'string' && p.val !== 'HEAD') {
                const songData = latestSongMap.get(p.val);
                if (songData) {
                    result.push(songData);
                }
            }
            p = p.next;
        }
        nowOp.toIndex = result.findIndex(r=>r.id==opId);
        return result;
    }

    // WebUI 托管
    router.get('/:roomId', async (koaCtx) => {
        if (process.env.NODE_ENV === "development") {
            ktvLogger.info('loading template')
            const templatePath = path.resolve(__dirname, '../static/songRoom.ejs')
            templateStr = fs.readFileSync(templatePath, 'utf-8')
        }
        const { roomId } = koaCtx.params
        const urlPath = koaCtx.path;
        // 检查路径末尾是否有斜杠
        if (urlPath.endsWith('/')) {
            koaCtx.status = 301;
            // 加上斜杠并保留 query 参数
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

            <p class="text-center text-slate-300 text-xs mt-8 uppercase tracking-widest font-bold">Powered by StarFreedomX</p>
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

