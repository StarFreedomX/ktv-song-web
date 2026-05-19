import { sha256 } from "js-sha256";

export function initUtils(lastHash){

    const normalizeBilibiliTitle = (rawTitle) => {
        let title = (rawTitle || "").trim();
        if (!title) return '';

        // "-哔哩哔哩" 的最外层括号
        // 【内容-哔哩哔哩】 -> 内容
        title = title.replace(/[【](.*)-哔哩哔哩[】]/i, '$1');
        // 如果没被括号包住，也直接删掉后缀
        title = title.replace(/-哔哩哔哩/i, '');

        const blacklist = /(ニコカラ|on[ /]?vocal|off[ /]?vocal|on\/off vocal|假名|字幕|罗马音|和声伴奏|纯k投屏|自用|完整版MV|KTV字幕|KTV|Karaoke|搬运|カラオケ|nicokara|卡拉OK|歌词|分唱)/gi;

        function cleanTitleNested(inputTitle) {
            const brackets = { '】': '【', ']': '[', ')': '(', '）': '（', '』': '『', '」': '「' };
            const leftBrackets = Object.values(brackets);

            let chars = (inputTitle || '').split('');
            let stack = [];
            for (let i = 0; i < chars.length; i++) {
                let char = chars[i];

                if (leftBrackets.includes(char)) {
                    stack.push({ type: char, index: i });
                } else if (brackets[char]) {
                    let lastMatchIdx = -1;
                    for (let j = stack.length - 1; j >= 0; j--) {
                        if (stack[j].type === brackets[char]) {
                            lastMatchIdx = j;
                            break;
                        }
                    }

                    if (lastMatchIdx !== -1) {
                        let left = stack.splice(lastMatchIdx, 1)[0];
                        let start = left.index;
                        let end = i;

                        let currentContent = chars.slice(start, end + 1).join('');

                        blacklist.lastIndex = 0;
                        if (blacklist.test(currentContent)) {
                            for (let k = start; k <= end; k++) {
                                chars[k] = "";
                            }
                        }
                    }
                }
            }

            let result = chars.join('');

            const emptyBrackets = /(\(\s*\)|\[\s*]|【\s*】|（\s*）|『\s*』|「\s*」)/g;
            while (emptyBrackets.test(result)) {
                result = result.replace(emptyBrackets, '');
            }

            return result.replace(/\s+/g, ' ').trim();
        }

        title = cleanTitleNested(title);
        title = title.replace(blacklist, "");
        return title.replace(/\s+/g, ' ').trim();
    };

    async function getHash(songLists) {
        // Only support the new SongLists shape: { queued: [], singing: null, sung: [] }
        if (!songLists || typeof songLists !== 'object') return "EMPTY_LIST_HASH";

        const queued = songLists.queued || [];
        const singing = songLists.singing || null;
        const sung = songLists.sung || [];

        const isEmpty = queued.length === 0 && !singing && sung.length === 0;
        if (isEmpty) return "EMPTY_LIST_HASH";

        const songToStr = (s) => `<${encodeURIComponent(s.id)}&${encodeURIComponent(s.title)}&${encodeURIComponent(s.url)}&${encodeURIComponent(s.addedBy || '')}>`;
        const queuedStr = queued.map(songToStr).join(',');
        const singingStr = singing ? songToStr(singing) : 'null';
        const sungStr = sung.map(songToStr).join(',');
        const str = ['q:', queuedStr, 'i:', singingStr, 's:', sungStr].join(';');

        // compute sha256 hex same as backend
        if (window.isSecureContext && window.crypto && window.crypto.subtle) {
            try {
                const msgBuffer = new TextEncoder().encode(str);
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
                return Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } catch (e) {
                console.warn("Native Crypto API failed, falling back to js-sha256...", e);
            }
        }
        if (typeof sha256 === 'function') {
            return sha256(str);
        }

        console.error("SHA-256 calculation failed: No supported method available.");
        return "EMPTY_LIST_HASH";
    }

    const parseBilibiliShortLink = async (link) => {
        if (!link) return;
        if (link.includes('b23.tv') || link.includes('bilibili.com') || link.match(/BV[a-zA-Z0-9]{10}/i)) {
            try {
                const res = await fetch(`api/parseLink`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        link
                    })
                }).then(r => r.json());
                if (res.success) {
                    return res.link;
                }
            } catch (e) {
                console.error("Next Song Error:", e);
            }
        }
        return link;
    }

    const handleAutoRecognize = (text, form) => {
        let raw = (text || "").trim();
        if (!raw) return;

        // 提取链接
        const urlMatch = raw.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:bilibili\.com|b23\.tv)\/[a-zA-Z0-9/._?=-]+/i);

        if (urlMatch) form.url = urlMatch[0];

        // 初始清理：只去掉链接，保留所有文字和括号
        const titleWithoutLink = raw.replace(/https?:\/\/\S+/g, '').trim();
        form.title = normalizeBilibiliTitle(titleWithoutLink);
    };

    const executeJump = (url, jumpMode) => {
        // 尝试从已有的 URL 中提取 page 参数和 BV 号
        // 此时的 url 可能是前端生成或后端解析出来的 bilibili://video/BVxxx?page=1
        let bvId = null;
        let pageIdx = null;

        const bvMatch = url.match(/BV[a-zA-Z0-9]{10}/i);
        if (bvMatch) {
            bvId = bvMatch[0];
            const urlObj = new URL(url.replace('bilibili://', 'https://')); // 借用 URL 对象解析参数
            pageIdx = urlObj.searchParams.get('page');
        }

        if (jumpMode === 'app') {
            // --- App ---
            // 如果后端已经处理好了协议，直接跳转即可
            if (url.startsWith('bilibili://')) {
                window.location.href = url;
            } else if (bvId) {
                // 如果拿到的还是原始链接
                window.location.href = `bilibili://video/${bvId}${pageIdx ? `?page=${pageIdx}` : ''}`;
            } else {
                window.location.href = url;
            }
        } else {
            // --- Web ---
            if (bvId) {
                // H5 端的分 P 参数通常是 p=page (从 1 开始编号)
                const pForWeb = pageIdx ? parseInt(pageIdx) : null;
                // 这里的unique_k=0不知道是什么，反正加上之后b站手机网页会显示更详细的信息
                const webUrl = `https://m.bilibili.com/video/${bvId}?unique_k=0${pForWeb ? `&p=${pForWeb}` : ''}`;
                window.open(webUrl, '_blank');
            } else {
                window.open(url, '_blank');
            }
        }
    }

    const backHome = () => {
        window.location.href = './';
    }

    // 获取最长递增子序列的索引下标
    function getLISIndices(arr) {
        const p = arr.slice();
        const result = [0];
        let i, j, u, v, c;
        const len = arr.length;
        for (i = 0; i < len; i++) {
            const arrI = arr[i];
            if (arrI !== -1) {
                j = result[result.length - 1];
                if (arr[j] < arrI) {
                    p[i] = j;
                    result.push(i);
                    continue;
                }
                u = 0;
                v = result.length - 1;
                while (u < v) {
                    c = (u + v) >> 1;
                    if (arr[result[c]] < arrI) u = c + 1;
                    else v = c;
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) p[i] = result[u - 1];
                    result[u] = i;
                }
            }
        }
        u = result.length;
        v = result[u - 1];
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }

    return {
        getHash,
        parseBilibiliShortLink,
        handleAutoRecognize,
        executeJump,
        backHome,
        getLISIndices,
        normalizeBilibiliTitle
    };
}
