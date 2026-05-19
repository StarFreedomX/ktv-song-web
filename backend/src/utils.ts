import axios from "axios";
import { BilibiliSearchVideo, BilibiliVideoPart, DATABASE_NAME, OpLog, Song, SongLists } from "@/types";
import ktvLogger from "@/logger";
import * as crypto from 'crypto';
import { Storage } from "@/storage";

const BILIBILI_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const BILIBILI_REFERER = 'https://www.bilibili.com/';
const BILIBILI_TAGS = ['カラオケ', 'ニコカラ', '投屏', 'ktv'] as const;
const BILIBILI_TAG_PRIORITY: Record<string, number> = {
    'ニコカラ': 0,
    'カラオケ': 1,
    '投屏': 2,
    'ktv': 3
};
const BILIBILI_TAG_MATCHERS: Record<(typeof BILIBILI_TAGS)[number], RegExp> = {
    'ニコカラ': /(ニコカラ|nicokara)/i,
    'カラオケ': /(カラオケ|karaoke)/i,
    '投屏': /(投屏)/i,
    'ktv': /(ktv)/i
};
const WBI_MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32,
    15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19,
    29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63,
    57, 62, 11, 36, 20, 34, 44, 52
] as const;

type BiliSearchItem = {
    bvid?: string
    title?: string
    pic?: string
    author?: string
}

function stripHtml(input: string) {
    return (input || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
}

function normalizeSearchText(input: string) {
    return (input || '')
        .toLowerCase()
        .replace(/[\s\-_.|/\\()[\]{}【】「」『』（）'"'`~!@#$%^&*+=,，。！？：:；;]/g, '');
}

function normalizeBilibiliPic(pic?: string) {
    if (!pic) return '';
    if (pic.startsWith('//')) return `https:${pic}`;
    if (pic.startsWith('http://') || pic.startsWith('https://')) return pic;
    return `https://${pic.replace(/^\/+/, '')}`;
}

function getMixinKey(orig: string) {
    return WBI_MIXIN_KEY_ENC_TAB.map(i => orig[i]).join('').slice(0, 32);
}

function encWbi(params: Record<string, string | number>, imgKey: string, subKey: string) {
    const mixinKey = getMixinKey(imgKey + subKey);
    const sanitizedParams = Object.fromEntries(
        Object.entries({
            ...params,
            wts: Math.floor(Date.now() / 1000)
        }).map(([key, value]) => [
            key,
            `${value}`.replace(/[!'()*]/g, '')
        ])
    );
    const query = new URLSearchParams(
        Object.entries(sanitizedParams).sort(([a], [b]) => a.localeCompare(b))
    ).toString();
    const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
    return `${query}&w_rid=${wRid}`;
}

async function getBilibiliCookie() {
    const response = await axios.get('https://www.bilibili.com/', {
        headers: {
            'User-Agent': BILIBILI_USER_AGENT,
            'Referer': BILIBILI_REFERER
        }
    });
    const setCookie = response.headers['set-cookie'];
    if (!Array.isArray(setCookie) || setCookie.length === 0) {
        return 'buvid3=codex-search';
    }
    const cookies = setCookie
        .map(cookie => cookie.split(';')[0])
        .filter(Boolean);
    if (!cookies.some(cookie => cookie.startsWith('buvid3='))) {
        cookies.push('buvid3=codex-search');
    }
    return cookies.join('; ');
}

async function getBilibiliWbiKeys(cookie: string) {
    const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
            'User-Agent': BILIBILI_USER_AGENT,
            'Referer': BILIBILI_REFERER,
            'Cookie': cookie
        }
    });
    const wbiImg = response.data?.data?.wbi_img;
    const imgKey = wbiImg?.img_url?.split('/').pop()?.split('.')[0];
    const subKey = wbiImg?.sub_url?.split('/').pop()?.split('.')[0];
    if (!imgKey || !subKey) {
        throw new Error('Failed to get bilibili wbi keys');
    }
    return { imgKey, subKey };
}

async function searchBilibiliVideosByKeyword(keyword: string, cookie: string, imgKey: string, subKey: string) {
    const headers = {
        'User-Agent': BILIBILI_USER_AGENT,
        'Referer': BILIBILI_REFERER,
        'Cookie': cookie
    };
    try {
        const legacyResponse = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
            params: {
                search_type: 'video',
                keyword,
                page: 1
            },
            headers
        });
        if (legacyResponse.data?.code === 0) {
            return (legacyResponse.data?.data?.result || []) as BiliSearchItem[];
        }
    } catch (error) {
        ktvLogger.warn('Bilibili legacy search failed', keyword, error instanceof Error ? error.message : error);
    }

    const query = encWbi({
        search_type: 'video',
        keyword,
        page: 1
    }, imgKey, subKey);
    const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`;
    const response = await axios.get(url, {
        headers: {
            ...headers
        }
    });
    if (response.data?.code !== 0) {
        throw new Error(`Bilibili search failed: ${response.data?.message || response.data?.code}`);
    }
    return (response.data?.data?.result || []) as BiliSearchItem[];
}

async function getBilibiliVideoParts(bvid: string) {
    const response = await axios.get('https://api.bilibili.com/x/player/pagelist', {
        params: { bvid },
        headers: {
            'User-Agent': BILIBILI_USER_AGENT,
            'Referer': BILIBILI_REFERER
        }
    });
    if (response.data?.code !== 0 || !Array.isArray(response.data?.data)) {
        return [];
    }
    return response.data.data.map((item: any): BilibiliVideoPart => ({
        page: item.page,
        part: item.part || `P${item.page}`
    }));
}

async function searchBilibiliKtvVideos(keyword: string) {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return [];

    const cookie = await getBilibiliCookie();
    const { imgKey, subKey } = await getBilibiliWbiKeys(cookie);
    const mergedMap = new Map<string, BilibiliSearchVideo>();

    await Promise.all(BILIBILI_TAGS.map(async (tag) => {
        const searchKeyword = `${trimmedKeyword} ${tag}`;
        try {
            const results = await searchBilibiliVideosByKeyword(searchKeyword, cookie, imgKey, subKey);
            results.slice(0, 8).forEach((item) => {
                const bvid = item.bvid?.trim();
                if (!bvid) return;
                const current = mergedMap.get(bvid);
                if (current) {
                    const titleText = stripHtml(item.title || current.title || '');
                    const matcher = BILIBILI_TAG_MATCHERS[tag];
                    if (matcher?.test(titleText) && !current.tags.includes(tag)) current.tags.push(tag);
                    return;
                }
                const titleText = stripHtml(item.title || bvid);
                const detectedTags = BILIBILI_TAGS.filter(t => BILIBILI_TAG_MATCHERS[t]?.test(titleText));
                mergedMap.set(bvid, {
                    bvid,
                    title: titleText,
                    pic: normalizeBilibiliPic(item.pic),
                    author: stripHtml(item.author || ''),
                    tags: detectedTags.length ? [...detectedTags] : [tag],
                    parts: []
                });
            });
        } catch (error) {
            ktvLogger.warn('Bilibili search tag failed', searchKeyword, error instanceof Error ? error.message : error);
        }
    }));

    const mergedResults = [...mergedMap.values()].slice(0, 20);
    await Promise.all(mergedResults.map(async (item) => {
        try {
            const parts = await getBilibiliVideoParts(item.bvid);
            item.parts = parts.length > 0 ? parts : [{ page: 1, part: item.title }];
        } catch (error) {
            ktvLogger.warn('Bilibili pagelist failed', item.bvid, error instanceof Error ? error.message : error);
            item.parts = [{ page: 1, part: item.title }];
        }
    }));

    return mergedResults;
}

function sortBilibiliSearchVideos(
    items: BilibiliSearchVideo[],
    keyword: string,
    clickCounts: Record<string, number> = {}
) {
    const normalizedKeyword = normalizeSearchText(keyword);
    return [...items].sort((a, b) => {
        // Relevance-first: prevent "just has ニコカラ" results from outranking the actual song name.
        const aScore = normalizedKeyword ? scoreBilibiliSearchVideo(a, keyword) : 0;
        const bScore = normalizedKeyword ? scoreBilibiliSearchVideo(b, keyword) : 0;
        if (aScore !== bScore) return bScore - aScore;

        const aClicks = clickCounts[a.bvid] || 0;
        const bClicks = clickCounts[b.bvid] || 0;
        if (aClicks !== bClicks) return bClicks - aClicks;

        // Then use tag priority as a tiebreaker.
        const aPriority = Math.min(...a.tags.map(tag => BILIBILI_TAG_PRIORITY[tag] ?? 99));
        const bPriority = Math.min(...b.tags.map(tag => BILIBILI_TAG_PRIORITY[tag] ?? 99));
        if (aPriority !== bPriority) return aPriority - bPriority;

        if (a.tags.length !== b.tags.length) return b.tags.length - a.tags.length;
        return a.title.localeCompare(b.title, 'zh-Hans-CN');
    });
}

function scoreBilibiliSearchVideo(item: BilibiliSearchVideo, keyword: string) {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) return 0;

    const titleText = normalizeSearchText(item.title);
    const tagsText = normalizeSearchText(item.tags.join(' '));
    const partsText = normalizeSearchText(item.parts.map(part => part.part).join(' '));
    const haystack = `${titleText} ${tagsText} ${partsText}`;

    // Token-based relevance: tolerate minor wording differences (e.g. "de" vs "der").
    // Only use title/parts for relevance; tags are too noisy for matching.
    const normalizedTitleParts = `${titleText} ${partsText}`.trim();
    if (!normalizedTitleParts) return 0;

    const tokens = (keyword || '')
        .toLowerCase()
        .split(/[\s\-_.|/\\()[\]{}【】「」『』（）'"'`~!@#$%^&*+=,，。！？：:；;]+/g)
        .map(t => normalizeSearchText(t))
        .filter(t => t.length >= 3);

    if (tokens.length === 0) {
        if (!normalizedTitleParts.includes(normalizedKeyword)) return 0;
    } else {
        const hitCount = tokens.reduce((acc, token) => acc + (normalizedTitleParts.includes(token) ? 1 : 0), 0);
        if (hitCount === 0) return 0;
    }

    let score = 10;
    if (titleText === normalizedKeyword) score += 200;
    if (titleText.includes(normalizedKeyword)) score += 120;
    if (partsText.includes(normalizedKeyword)) score += 50;
    // tagsText intentionally excluded from matching; keep as small bonus only if keyword fully matches.
    if (tagsText.includes(normalizedKeyword)) score += 10;

    const firstIndex = haystack.indexOf(normalizedKeyword);
    if (firstIndex >= 0) score += Math.max(0, 40 - firstIndex);
    score += Math.max(0, 20 - Math.max(0, item.title.length - keyword.length));

    // Token hits: reward each token matched in title/parts.
    if (tokens.length) {
        const tokenHits = tokens.reduce((acc, token) => acc + (normalizedTitleParts.includes(token) ? 1 : 0), 0);
        score += tokenHits * 35;
    }
    return score;
}

function filterBilibiliSearchVideosByRelevance(items: BilibiliSearchVideo[], keyword: string) {
    return items.filter(item => scoreBilibiliSearchVideo(item, keyword) > 0);
}

function mergeBilibiliSearchVideos(existing: BilibiliSearchVideo[], incoming: BilibiliSearchVideo[]) {
    const merged = new Map<string, BilibiliSearchVideo>();
    [...existing, ...incoming].forEach((item) => {
        const current = merged.get(item.bvid);
        if (!current) {
            merged.set(item.bvid, {
                ...item,
                tags: [...item.tags],
                parts: [...item.parts]
            });
            return;
        }

        current.title = current.title || item.title;
        current.pic = current.pic || item.pic;
        current.author = current.author || item.author;
        current.tags = [...new Set([...current.tags, ...item.tags])];
        const partMap = new Map(current.parts.map(part => [part.page, part]));
        item.parts.forEach(part => {
            if (!partMap.has(part.page)) partMap.set(part.page, part);
        });
        current.parts = [...partMap.values()].sort((a, b) => a.page - b.page);
    });
    return [...merged.values()];
}

function filterCachedBilibiliSearchVideos(items: BilibiliSearchVideo[], keyword: string, clickCounts: Record<string, number> = {}) {
    return items
        .map(item => ({
            item,
            clicks: clickCounts[item.bvid] || 0,
            score: scoreBilibiliSearchVideo(item, keyword),
            hasPreferredTag: item.tags.some(tag => (BILIBILI_TAG_PRIORITY[tag] ?? 99) <= 2)
        }))
        .filter(entry => entry.score > 0 && (entry.hasPreferredTag || entry.clicks > 0))
        .sort((a, b) => {
            if (a.hasPreferredTag !== b.hasPreferredTag) return a.hasPreferredTag ? -1 : 1;
            if (a.score !== b.score) return b.score - a.score;
            if (a.clicks !== b.clicks) return b.clicks - a.clicks;
            return 0;
        })
        .map(entry => entry.item);
}

/**
 * 解析 B23.TV 短链接并提取 BV 号
 * @param inputUrl
 * @returns 返回提取到的 BV 号
 */
async function resolveBilibiliData(inputUrl: string) {
    let targetUrl = inputUrl;

    if (inputUrl.includes('b23.tv')) {
        try {
            const response = await axios(inputUrl, {
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: { 'User-Agent': 'Mozilla/5.0...' }
            });
            targetUrl = response.headers['location'] || inputUrl;
        } catch (error) {
            targetUrl = error.response?.headers?.location || inputUrl;
        }
    }

    try {
        const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
        const urlObj = new URL(normalizedUrl);
        const bvMatch = urlObj.pathname.match(/BV[a-zA-Z0-9]{10}/i);
        if (!bvMatch) return null;

        const bvid = bvMatch[0];
        const pParam = urlObj.searchParams.get('p');

        if (pParam) {
            const pNum = parseInt(pParam, 10);
            return {
                url: `bilibili://video/${bvid}?page=${Math.max(0, pNum - 1)}`,
                bvid: bvid,
                pNum: pNum
            };
        }

        return {
            url: `bilibili://video/${bvid}`,
            bvid: bvid,
            pNum: 0
        };
    } catch (e) {
        return null;
    }
}

/**
 * 对歌曲进行变基操作，并返回最新歌曲列表顺序
 * @param nowSongs  后端当前歌曲集合
 * @param baseSongIdArray   base歌曲排列顺序
 * @param ops   后端从base开始执行的操作(不包括生成base)，index是移动后该元素的index
 * @param nowOp 当前操作(基于base baseSongIdArray)，index是移动后该元素的index
 */
function songOperation(nowSongs: Song[], baseSongIdArray: string[], ops: OpLog[], nowOp: OpLog): Song[] {
    ktvLogger.trace({ baseSongIdArray, ops, nowOp })
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
    [...sortedOps, nowOp].forEach(op => {
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
        [current.next, numberNode.prev] = [numberNode, current];
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
                [current.next, idNode.prev] = [idNode, current];
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
        if (toIndex === -1) {
            if (opNode.prev) opNode.prev.next = opNode.next;
            if (opNode.next) opNode.next.prev = opNode.prev;
            opNode.prev = opNode.next = null;
            continue;
        }

        // 获取插入位置的前一个元素
        const toSongNext: ListNode = toIndex === 0
            ? head
            : idNodes.get(lastArray.filter(s => s !== opId).at(toIndex - 1));
        // 如果本身在链表中，先断开连接
        if (opNode.prev) opNode.prev.next = opNode.next;
        if (opNode.next) opNode.next.prev = opNode.prev;
        // 新连接
        [opNode.next, opNode.prev] = [toSongNext.next, toSongNext];
        [toSongNext.next.prev, toSongNext.next] = [opNode, opNode];

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
    if (toIndex === -1) {
        if (opNode.prev) opNode.prev.next = opNode.next;
        if (opNode.next) opNode.next.prev = opNode.prev;
        opNode.prev = opNode.next = null;
    } else {
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
    nowOp.toIndex = result.findIndex(r => r.id == opId);
    return result;
}

// 生成哈希工具函数
function getHash(songLists: SongLists) {
    if (songListTools.isEmpty(songLists)) return "EMPTY_LIST_HASH"; // 给空列表一个固定标识
    const str = songListTools.songListToStr(songLists);
    ktvLogger.trace('hash src:', str)
    const hashValue = crypto.createHash('sha256').update(str).digest('hex');
    ktvLogger.trace('hash value:', hashValue);
    return hashValue;
}

const songListTools = {
    isEmpty(songLists: SongLists): boolean {
        return !songLists || (songLists.queued.length === 0 && !songLists.singing && songLists.sung.length === 0);
    },
    songToStr: (s: Song) => `<${encodeURIComponent(s.id)}&${encodeURIComponent(s.title)}&${encodeURIComponent(s.url)}&${encodeURIComponent(s.addedBy || '')}>`,
    songListToStr: (songLists: SongLists) => [
        'q:', songLists.queued.map(songListTools.songToStr).join(','),
        'i:', songLists.singing ? songListTools.songToStr(songLists.singing) : 'null',
        's:', songLists.sung.map(songListTools.songToStr).join(',')
    ].join(';'),
    initSongLists: async (storage: Storage, roomId: string): Promise<SongLists>=> {
        const storageSongLists = (await storage.get<SongLists>(DATABASE_NAME, roomId) || songListTools.getEmptySongLists())
        return {
            queued: storageSongLists.queued || [],
            singing: storageSongLists.singing || null,
            sung: storageSongLists.sung || [],
        }
    },
    // 不能使用常量，因为对象是地址传递
    getEmptySongLists: (): SongLists => ({
        queued: [],
        singing: null,
        sung: []
    })
}

export {
    filterCachedBilibiliSearchVideos,
    filterBilibiliSearchVideosByRelevance,
    mergeBilibiliSearchVideos,
    normalizeSearchText,
    resolveBilibiliData,
    scoreBilibiliSearchVideo,
    searchBilibiliKtvVideos,
    sortBilibiliSearchVideos,
    songOperation,
    getHash,
    songListTools
};
