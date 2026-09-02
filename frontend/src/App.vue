<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { initUtils } from "./utils";
import { useRoute } from 'vue-router';
import ShuffleConfirmModal from "./modals/ShuffleConfirmModal.vue";
import SettingsModal from "./modals/SettingsModal.vue";
import FavoritesModal from "./modals/FavoritesModal.vue";
import JumpConfirmModal from "./modals/JumpConfirmModal.vue";
import DeleteConfirmModal from "./modals/DeleteConfirmModal.vue";
import EditSongModal from "./modals/EditSongModal.vue";
import AddSongModal from "./modals/AddSongModal.vue";
import BilibiliSearchModal from "./modals/BilibiliSearchModal.vue";
import NicknameModal from "./modals/NicknameModal.vue";
import BottomNav from "./modals/BottomNav.vue";
import QueueList from "./modals/QueueList.vue";
import HistoryList from "./modals/HistoryList.vue";
import ComfirmButton from "./modals/components/ComfirmButton.vue";
import Toast from "./components/Toast.vue";

// 扩展详细状态定义
const SyncStatus = Object.freeze({
    // 连接层
    WS_CONNECTING: { label: 'WS 连接中', color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse' },
    WS_ONLINE: { label: 'WS 在线', color: 'text-green-500', dot: 'bg-green-500' },
    POLLING_IDLE: { label: 'HTTP 待机', color: 'text-blue-500', dot: 'bg-blue-400' },
    OFFLINE: { label: '已断开', color: 'text-red-500', dot: 'bg-red-500' },
    // 动作层
    FETCHING: { label: '同步中...', color: 'text-indigo-500', dot: 'bg-indigo-500 animate-spin' },
    SUCCESS: { label: '拉取成功', color: 'text-emerald-500', dot: 'bg-emerald-500' },
    FAILED: { label: '同步失败', color: 'text-rose-600', dot: 'bg-rose-600' }
});

const UpdateStatus = Object.freeze({
    IDLE: 0,
    WAITING: 1,
    FETCHING: 2
});

const route = useRoute();
const roomIdFromUrl = route.query.roomId;
const roomId = ref(roomIdFromUrl);
const copyLinkStatus = ref('');
const helpUrl = 'https://jcntv1iqoo5s.feishu.cn/wiki/Ytt1wNh88i6E9jkEndhcxNmYnBd';

watch(() => route.query.roomId, (newRoomId) => {
    roomId.value = newRoomId;
}, { immediate: true });

watch(roomId, (newRoomId) => {
    document.title = newRoomId ? `${newRoomId} - KTV房间` : 'KTV房间';
}, { immediate: true });

// 字符串常量
const EMPTY_HASH = "EMPTY_LIST_HASH";

// 尝试读取统一存放的配置
const localData = JSON.parse(localStorage.getItem('ktv_config') || '{}');

// 初始化对象（如果统一配置里没有，就去拿以前分开存的旧 Key）
const cfg = ref({
    nickname: localData.nickname ?? (localStorage.getItem('ktv_nickname') || ''),
    jumpMode: localData.jumpMode ?? (localStorage.getItem('ktv_jump_mode') || 'web'),
    autoJump: localData.autoJump ?? (localStorage.getItem('ktv_auto_jump') === 'true'),
    hostMode: localData.hostMode ?? (localStorage.getItem('ktv_host_mode') === 'true'),
    wsMode: localData.wsMode ?? (localStorage.getItem('ktv_ws_mode') !== 'false'),
    bilibiliInstrumentalWarning: localData.bilibiliInstrumentalWarning ?? true
});

// api接口
const lastHash = ref(EMPTY_HASH);
const commitApiUrl = "api/songOperation"
const loadSongListUrl = "api/songListInfo"
const nextSongUrl = "api/nextSong"
const prevSongUrl = "api/prevSong"
const undoSungUrl = "api/undoSung"
const shuffleSongUrl = "api/shuffle"
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/api/ws?roomId=${roomId.value}&nickname=${encodeURIComponent(cfg.value.nickname || '')}`;

// 控制页面元素的变量
/** @type {import('vue').Ref<String>} */
const activeTab = ref(localStorage.getItem('ktv_active_tab') || 'queue');
const isDragging = ref(false);
const deletingSong = ref(null);
const editingSong = ref(null);
const isAddingToFavorites = ref(false);
const showFavoritesModal = ref(false);
const showNicknameModal = ref(false);
const showShuffleConfirm = ref(false);
const showSettings = ref(false);
const showAddModal = ref(false);
const showBiliSearchModal = ref(false);
const roomNotFound = ref(false);
const currentSync = ref(SyncStatus.WS_CONNECTING);

// 存储（与后端保持一致的结构）
/** @type {import('vue').Ref<Song[]>} */
const queued = ref([]);
/** @type {import('vue').Ref<Song|null>} */
const singing = ref(null);
/** @type {import('vue').Ref<Song[]>} */
const sung = ref([]);
const favorites = ref(JSON.parse(localStorage.getItem('ktv_favorites') || '[]'));

// 临时变量
const editForm = ref({ title: '', url: '' });
const favSearchQuery = ref('');
const tempNickname = ref('');
// const fileInput = ref(null);
const form = ref({ title: '', url: '' })
const pendingJumpUrl = ref(null); // 存储待跳转的 URL
const jumpSongTitle = ref('');    // 存储待跳转的歌曲标题
const autoInput = ref('');
const biliSearchKeyword = ref('');
const biliSearchLoading = ref(false);
const biliSearchResults = ref([]);
const expandedBvid = ref(null);
const isRefreshing = ref(false);
const updateStatus = ref(UpdateStatus.IDLE);
const allowUpdate = computed(() => !isDragging.value && !isRefreshing.value);

// 工具函数
const {
    getHash,
    parseBilibiliShortLink,
    handleAutoRecognize,
    executeJump,
    backHome,
    getLISIndices,
    normalizeBilibiliTitle
} = initUtils(lastHash);

// 辅助函数：显示瞬时状态并恢复
const showTransientStatus = (status, delay = 1000) => {
    currentSync.value = status;
    setTimeout(() => {
        // 根据当前模式恢复基础状态
        if (cfg.value.wsMode) {
            currentSync.value = (socket && socket.readyState === WebSocket.OPEN)
                ? SyncStatus.WS_ONLINE
                : SyncStatus.WS_CONNECTING;
        } else {
            currentSync.value = SyncStatus.POLLING_IDLE;
        }
    }, delay);
};

// 全局操作失败提示（toast）：展示后端返回的错误原因
const toastMsg = ref('');
let toastTimer = null;
const showToast = (msg) => {
    toastMsg.value = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg.value = ''; }, 2500);
};

const copyRoomLink = async () => {
    const roomUrl = window.location.href;

    try {
        await navigator.clipboard.writeText(roomUrl);
        copyLinkStatus.value = '已复制，可分享给别人点歌';
    } catch {
        const textArea = document.createElement('textarea');
        textArea.value = roomUrl;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyLinkStatus.value = '已复制，可分享给别人点歌';
    }

    setTimeout(() => {
        if (copyLinkStatus.value === '已复制，可分享给别人点歌') {
            copyLinkStatus.value = '';
        }
    }, 1500);
};

const openHelp = () => {
    window.open(helpUrl, '_blank', 'noopener,noreferrer');
};

//监听器
// 逻辑拆分：待唱/正在唱/已唱（与后端一致）
const queueList = computed({
    get: () => queued.value,
    set: (newList) => { queued.value = newList; }
});
const historyList = computed(() => sung.value);
const filteredFavorites = computed(() => {
    if (!favSearchQuery.value.trim()) {
        return favorites.value; //
    }
    const query = favSearchQuery.value.toLowerCase();
    return favorites.value.filter(fav => fav.title.toLowerCase().includes(query) || fav.url.toLowerCase().includes(query)); //
});
watch(activeTab, (val) => localStorage.setItem('ktv_active_tab', val));
watch(cfg, (newVal) => localStorage.setItem('ktv_config', JSON.stringify(newVal)), { deep: true });
watch(favorites, (val) => localStorage.setItem('ktv_favorites', JSON.stringify(val)), { deep: true });
watch(showAddModal, (visible) => {
    if (!visible) {
        biliSearchLoading.value = false;
        biliSearchKeyword.value = '';
        biliSearchResults.value = [];
        expandedBvid.value = null;
        autoInput.value = '';
        form.value = { title: '', url: '' };
        isAddingToFavorites.value = false;
    }
});

// 监听正在播放歌曲的变化
watch(() => singing.value, (newSong, oldSong) => {
    // 只有当开启了主机模式，且新歌确实存在，且与旧歌不同（通过 ID 判断）时执行
    if (cfg.value.hostMode && newSong && (!oldSong || newSong.id !== oldSong.id)) {
        console.log('主机模式：检测到切歌，正在自动跳转...', newSong.title);

        if (newSong.url) {
            // 主机模式下直接跳转，不弹窗确认
            // 为了保证稳定性，延迟 800ms 等待数据同步完成
            setTimeout(() => {
                window.location.href = newSong.url;
            }, 800);
        }
    }
});
watch([allowUpdate, updateStatus], ([canUpdate, status]) => {
    if (canUpdate && status === UpdateStatus.WAITING) {
        performUpdate();
    }
});

async function performUpdate() {
    updateStatus.value = UpdateStatus.FETCHING;
    currentSync.value = SyncStatus.FETCHING; // 切换到拉取中

    try {
        await load();
        updateStatus.value = UpdateStatus.IDLE;
        showTransientStatus(SyncStatus.SUCCESS); // 成功闪烁
    } catch (e) {
        console.error(e);
        updateStatus.value = UpdateStatus.IDLE;
        showTransientStatus(SyncStatus.FAILED); // 失败闪烁
    }
}

// 收藏相关
const isFavorited = (song) => {
    return favorites.value.some(f => f.url === song.url);
};

const toggleFavorite = (song) => {
    const index = favorites.value.findIndex(f => f.url === song.url);
    if (index > -1) {
        favorites.value.splice(index, 1);
    } else {
        favorites.value.push({
            id: 'fav-' + Math.random().toString(36).slice(2, 11), title: song.title, url: song.url
        });
    }
};

const addFavoriteToQueue = async (fav) => {
    await reAdd({
        title: fav.title,
        url: fav.url
    });
};

const exportFavorites = () => {
    const dataStr = JSON.stringify(favorites.value, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ktv_favorites_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                const currentUrls = new Set(favorites.value.map(f => f.url));
                const newItems = imported.filter(item => item.title && item.url && !currentUrls.has(item.url)).map(item => ({
                    id: 'fav-' + Math.random().toString(36).slice(2, 11), title: item.title, url: item.url
                }));

                if (newItems.length > 0) {
                    favorites.value = [...favorites.value, ...newItems];
                    alert(`成功导入 ${newItems.length} 首歌曲`);
                } else {
                    alert('没有发现新的歌曲或文件格式不正确');
                }
            } else {
                alert('无效的 JSON 格式：应为数组');
            }
        } catch (err) {
            console.error(err);
            alert('解析 JSON 失败');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};


//歌曲操作相关
const commitOp = async (opData) => {
    let cleanSong = null;
    if (opData.song) {
        const { id, title, url, state, addedBy } = opData.song;
        cleanSong = { id, title, url, state, addedBy };
    }

    try {
        const res = await fetch(`${commitApiUrl}?roomId=${roomId.value}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                idArrayHash: lastHash.value,
                toIndex: opData.toIndex, song: cleanSong
            })
        }).then(r => r.json());

        if (res.success) {
            if (lastHash.value !== res.hash) {
                updateStatus.value = UpdateStatus.WAITING;
            } else {
                lastHash.value = res.hash;
                updateStatus.value = UpdateStatus.IDLE
            }
            if (res.song && opData.song) {
                // 更新本地缓存中的歌曲信息（在 queued / singing / sung 中查找）
                const id = opData.song.id;
                let localSong = queued.value.find(s => s.id === id) || sung.value.find(s => s.id === id) || (singing.value && singing.value.id === id ? singing.value : null);
                if (localSong) {
                    localSong.url = res.song.url; //bilibili://...
                    localSong.id = res.song.id;   // BV...
                }
            }
            return true;
        } else if (res.code === 'REJECT') {
            // 如果被拒绝，说明前端 Hash 过时
            lastHash.value = EMPTY_HASH; // 重置
            updateStatus.value = UpdateStatus.WAITING;
        } else if (res.msg) {
            // 其他失败（校验不通过、房间不存在等）：toast 提示后端原因
            showToast(res.msg);
        }
    } catch (e) {
        console.error("API Error:", e);
    }
    return false;
}

const handleAdd = async () => {
    if (!form.value.title || !form.value.url) return;
    if (isAddingToFavorites.value) {
        // 如果是添加收藏逻辑
        const newFav = {
            id: Date.now(),
            title: form.value.title || '未命名歌曲',
            url: await parseBilibiliShortLink(form.value.url)
        };
        // 检查是否已存在
        if (!favorites.value.some(f => f.url === newFav.url)) {
            favorites.value.push(newFav);
        }
        resetAddSongState();
    } else {
        // 原有的添加待唱列表逻辑
        await add();
    }
};

const reAdd = async (song) => {
    form.value.title = song.title;
    form.value.url = song.url;
    await handleAdd();
};

const add = async () => {
    await enqueueSong({
        title: form.value.title,
        url: form.value.url
    });
}

const enqueueSong = async ({ title, url, onSuccess }) => {
    let rawUrl = (url || '').trim();
    if (!title || !rawUrl) return false;

    // 计算有效长度（排除正在删除的）
    const effectiveLen = queued.value.filter(s => !s.isDeleting).length;

    const newSong = {
        id: 's-' + Math.random().toString(36).slice(2, 11),
        title,
        url: rawUrl,
        addedBy: cfg.value.nickname,
        isNew: true
    };

    // 插入到 queued 中（乐观更新；失败时回滚并保留表单内容，方便修改重试）
    queued.value.splice(effectiveLen, 0, newSong);

    setTimeout(() => {
        const target = queued.value.find(s => s.id === newSong.id);
        if (target) target.isNew = false;
    }, 600);

    const success = await commitOp({
        song: newSong, toIndex: effectiveLen // 使用排除删除项后的索引
    });
    if (!success) {
        // 失败时回滚乐观插入的歌曲，避免幽灵歌曲留在队列
        // （后端拒绝不会改变 hash，随后拉取对账会因 changed:false 被跳过，必须主动移除）
        const ghostIdx = queued.value.findIndex(s => s.id === newSong.id);
        if (ghostIdx !== -1) queued.value.splice(ghostIdx, 1);
        updateStatus.value = UpdateStatus.WAITING;
    }
    else {
        if (typeof onSuccess === 'function') {
            await onSuccess();
        }
        resetAddSongState();
    }
    return success;
};

const resetAddSongState = () => {
    showAddModal.value = false;
    isAddingToFavorites.value = false;
    autoInput.value = '';
    form.value = { title: '', url: '' };
    biliSearchKeyword.value = '';
    biliSearchResults.value = [];
    expandedBvid.value = null;
};

const searchBilibiliSongs = async () => {
    const keyword = biliSearchKeyword.value.trim();
    expandedBvid.value = null;
    if (!keyword) {
        biliSearchResults.value = [];
        return;
    }

    biliSearchLoading.value = true;
    try {
        const res = await fetch(`api/bilibiliSearch?keyword=${encodeURIComponent(keyword)}`).then(r => r.json());
        biliSearchResults.value = res.success ? (res.items || []) : [];
        if (biliSearchResults.value.length) showBiliSearchModal.value = true;
    } catch (e) {
        console.error('Bilibili Search Error:', e);
        biliSearchResults.value = [];
    } finally {
        biliSearchLoading.value = false;
    }
};

const trackBilibiliSelection = async (item) => {
    try {
        await fetch('api/bilibiliSearch/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bvid: item.bvid })
        });
    } catch (e) {
        console.error('Track Bilibili Selection Error:', e);
    }
};

const getBilibiliSongUrl = (bvid, page) => {
    // Bilibili App deep link uses `page` (0-based) for 分P.
    if (!page || page <= 1) return `bilibili://video/${bvid}?page=0`;
    return `bilibili://video/${bvid}?page=${page - 1}`;
};

const buildBilibiliSongTitle = (item, part) => {
    if (!part || !item.parts || item.parts.length <= 1) return item.title;
    return `${item.title} - P${part.page} ${part.part}`;
};

const OFF_VOCAL_HINT_PATTERNS = [
    /\boff[\s_-]*vocal\b/i,
    /\boffvocal\b/i,
    /\bno[\s_-]*vocal\b/i,
    /\bwithout[\s_-]*vocal\b/i,
    /\binstrumental\b/i,
    /\binst(?:\.|rumental)?\b/i,
    /\bkaraoke(?:\s+ver(?:sion)?)?\b/i,
    /オフボーカル/i,
    /伴奏/i
];

const ON_VOCAL_HINT_PATTERNS = [
    /\bon[\s_-]*vocal\b/i,
    /\bonvocal\b/i,
    /\bwith[\s_-]*vocal\b/i,
    /人声/i,
    /原唱/i
];

const hasOffVocalHint = (text) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) return false;
    return OFF_VOCAL_HINT_PATTERNS.some(pattern => pattern.test(normalizedText));
};

const hasOnVocalHint = (text) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) return false;
    return ON_VOCAL_HINT_PATTERNS.some(pattern => pattern.test(normalizedText));
};

const getVocalHintState = (text) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) return 'unknown';
    if (hasOnVocalHint(normalizedText)) return 'vocal';
    if (hasOffVocalHint(normalizedText)) return 'instrumental';
    return 'unknown';
};

const shouldWarnBilibiliInstrumental = (item, part = null) => {
    if (!item) return false;

    const hasMultipleParts = Array.isArray(item.parts) && item.parts.length > 1;
    if (hasMultipleParts) {
        const currentPart = part || item.parts[0];
        const partHint = currentPart ? getVocalHintState(currentPart.part) : 'unknown';
        if (partHint === 'vocal') return false;
        if (partHint === 'instrumental') return true;
        return false;
    }

    const titleHint = getVocalHintState(item.title);
    if (titleHint === 'vocal') return false;
    if (titleHint === 'instrumental') return true;

    const tagCandidates = [
        item.title,
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...(Array.isArray(item.rawTags) ? item.rawTags : []),
    ];
    if (tagCandidates.some(hasOnVocalHint)) return false;
    if (tagCandidates.some(hasOffVocalHint)) return true;
    return false;
};

const confirmBilibiliInstrumentalSelection = (item, part = null) => {
    if (cfg.value.bilibiliInstrumentalWarning === false) return true;
    if (!shouldWarnBilibiliInstrumental(item, part)) return true;
    const songTitle = buildBilibiliSongTitle(item, part);
    return window.confirm(`检测到这首可能是仅伴奏 / off vocal 版本：\n\n${songTitle}\n\n可在搜索界面双击标题打开 B 站确认。\n如果这是误报，也可以在设置中关闭这个提示。\n\n是否继续点歌？`);
};

const addBilibiliSearchResult = async (item) => {
    const part = item.parts?.[0] || null;
    if (!confirmBilibiliInstrumentalSelection(item, part)) return;
    await enqueueSong({
        title: normalizeBilibiliTitle(buildBilibiliSongTitle(item, part)),
        url: getBilibiliSongUrl(item.bvid, part?.page || 1),
        onSuccess: async () => {
            await trackBilibiliSelection(item);
            showBiliSearchModal.value = false;
        }
    });
};

const addBilibiliPart = async ({ item, part }) => {
    if (!confirmBilibiliInstrumentalSelection(item, part)) return;
    await enqueueSong({
        title: normalizeBilibiliTitle(buildBilibiliSongTitle(item, part)),
        url: getBilibiliSongUrl(item.bvid, part.page),
        onSuccess: async () => {
            await trackBilibiliSelection(item);
            showBiliSearchModal.value = false;
        }
    });
};

const toggleBilibiliParts = (bvid) => {
    expandedBvid.value = expandedBvid.value === bvid ? null : bvid;
};

const previewBilibiliSearchResult = (item) => {
    if (!item?.bvid) return;
    executeJump(getBilibiliSongUrl(item.bvid, 1), cfg.value.jumpMode);
};

// 点击垃圾桶图标，仅记录要删除的对象并显示弹窗
const remove = (songObj) => {
    deletingSong.value = songObj;
};

// 用户在弹窗点击“确认移除”
const confirmDelete = async () => {
    const songObj = deletingSong.value;
    if (!songObj) return;

    deletingSong.value = null;
    songObj.isDeleting = true;

    setTimeout(async () => {
        // 从 queued / singing / sung 中移除
        const qIdx = queued.value.findIndex(s => s.id === songObj.id);
        if (qIdx !== -1) queued.value.splice(qIdx, 1);
        else if (singing.value && singing.value.id === songObj.id) singing.value = null;
        else sung.value = sung.value.filter(s => s.id !== songObj.id);
        await commitOp({
            song: songObj, toIndex: -1
        });
    }, 400); // 调整为 400ms 以匹配 CSS 坍塌速度
};

const moveToTop = async (song) => {
    // 如果已经在第一位，无需操作
    if (queueList.value[0]?.id === song.id) return;

    // 这里的逻辑与 load 中的“主动移动”一致
    const oldIndex = queued.value.findIndex(s => s.id === song.id);
    if (oldIndex === -1) return;

    song.isDeleting = true;

    setTimeout(async () => {
        // 从原位置移除
        const [movedItem] = queued.value.splice(oldIndex, 1);
        // 插入到最前面 (待唱列表最前面)
        queued.value.unshift(movedItem);

        // 重置状态并触发高亮
        movedItem.isDeleting = false;
        movedItem.isNew = true;

        // 发送给后端，toIndex: 目标顺位
        const success = await commitOp({
            song: movedItem, toIndex: 0
        });

        setTimeout(() => {
            movedItem.isNewActive = true;
        }, 10);

        if (!success) {
            updateStatus.value = UpdateStatus.WAITING;
        } else {
            setTimeout(() => {
                movedItem.isNew = false;
                movedItem.isNewActive = false;
                movedItem.isTop = true;
                setTimeout(() => {
                    movedItem.isTop = false;
                }, 1200);
            }, 600);
        }
    }, 350);
};

const undoSung = async (song) => {
    try {

        const body = { idArrayHash: lastHash.value };
        if (!song?.id) return;
        body.songId = song.id;
        const res = await fetch(`${undoSungUrl}?roomId=${roomId.value}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        }).then(r => r.json());

        if (res.code === 'REJECT') {
            lastHash.value = EMPTY_HASH;
        }
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    } catch (e) {
        console.error('Undo Sung Error:', e);
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    }
};

const nextSong = async () => {
    try {
        const res = await fetch(`${nextSongUrl}?roomId=${roomId.value}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                idArrayHash: lastHash.value
            })
        }).then(r => r.json());

        if (res.code === 'REJECT') {
            lastHash.value = EMPTY_HASH;
        }
        // 若成功或拒绝都触发拉取以同步最新状态
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }

    } catch (e) {
        console.error("Next Song Error:", e);
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    }
};

const prevSong = async () => {
    try {
        const res = await fetch(`${prevSongUrl}?roomId=${roomId.value}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                idArrayHash: lastHash.value
            })
        }).then(r => r.json());

        if (res.code === 'REJECT') {
            lastHash.value = EMPTY_HASH;
        }
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    } catch (e) {
        console.error("Prev Song Error:", e);
        if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    }
};

async function shuffleSongs() {
    showShuffleConfirm.value = false;
    try {
        const response = await fetch(`${shuffleSongUrl}?roomId=${roomId.value}`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            updateStatus.value = UpdateStatus.WAITING;
        }
    } catch (e) {
        console.error("Shuffle failed:", e);
    }
}


const load = async () => {
    if (isDragging.value) return;
    if (roomNotFound.value) return;
    try {
        const url = `${loadSongListUrl}?roomId=${roomId.value}&lastHash=${lastHash.value}`;
        const res = await fetch(url);
        if (res.status === 404) {
            roomNotFound.value = true;
            stopSyncDrivers();
            return;
        }
        const data = await res.json();

        if (data.changed) {
            const oldQueued = [...queued.value];

            // 直接处理新的 SongLists 返回结构
            const lists = data.list;
            const queuedArr = lists.queued || [];
            const newQueuedSongsData = [...queuedArr];

            // sung 和 singing 独立赋值
            sung.value = lists.sung || [];
            singing.value = lists.singing || null;
            // 如果新数据就是空的，直接赋值并更新 Hash，跳过后续复杂的 LIS 计算
            if (lists.queued.length === 0) {
                queued.value = [];
                lastHash.value = data.hash || EMPTY_HASH;
                return;
            }

            lastHash.value = data.hash;

            // 计算 ID 映射（仅基于 queued）
            const oldIdMap = new Map();
            oldQueued.forEach((s, i) => {
                if (!s.isDeleting) oldIdMap.set(s.id, i);
            });

            // 识别“主动移动”的 ID（仅考虑 queued）
            const source = newQueuedSongsData.map(s => oldIdMap.has(s.id) ? oldIdMap.get(s.id) : -1);
            const lisIndices = new Set(getLISIndices(source));

            const activeMoveIds = new Set();
            newQueuedSongsData.forEach((s, newIdx) => {
                const oldIdx = oldIdMap.get(s.id);
                if (oldIdx !== undefined && oldIdx !== newIdx && !lisIndices.has(newIdx)) {
                    activeMoveIds.add(s.id);
                }
            });

            // 让删除项和“改动项”一起执行退出动画（仅针对老的 queued）
            const newIdSet = new Set(newQueuedSongsData.map(s => s.id));
            oldQueued.forEach(s => {
                if (!newIdSet.has(s.id) || activeMoveIds.has(s.id)) {
                    s.isDeleting = true;
                }
            });

            // 等待退出动画完成
            setTimeout(() => {
                queued.value = newQueuedSongsData.map((s, newIdx) => {
                    const oldIdx = oldIdMap.get(s.id);
                    const isNew = oldIdx === undefined;
                    const isActiveMove = activeMoveIds.has(s.id);
                    const isAffected = !isNew && !isActiveMove && oldIdx !== newIdx;
                    return {
                        ...s,
                        isMoved: isActiveMove,
                        isNew: (isNew || isActiveMove),
                        isAffected: isAffected
                    };
                });



                setTimeout(() => {
                    queued.value.forEach(s => {
                        if (s.isNew) s.isNewActive = true;
                    });
                }, 10);

                // 清理状态
                setTimeout(() => {
                    queued.value.forEach(s => {
                        s.isNew = s.isAffected = s.isNewActive = false;
                    });
                }, 600);
            }, 350);
        }
    } catch (e) {
        console.error("Load Error:", e);
    }
};

const goToLink = (song) => {
    if (song && song.url) {
        pendingJumpUrl.value = /^https?:\/\//i.test(song.url) ? song.url : `https://${song.url}`;
        jumpSongTitle.value = song.title;

        if (cfg.value.autoJump) {
            confirmJump(); // 直接执行跳转
        }
    }
};

const confirmJump = () => {
    if (pendingJumpUrl.value) {
        const url = pendingJumpUrl.value;
        executeJump(url, cfg.value.jumpMode);
        pendingJumpUrl.value = null;
    }
};

const onDragChange = async (evt) => {
    isDragging.value = false;
    if (evt.moved) {
        const { element, newIndex } = evt.moved;
        // 因为 queueList 在 songs 的最前面，所以 newIndex 就是最终 index
        await commitOp({
            song: element, toIndex: newIndex
        });
    }
}

// 点击编辑按钮触发
const startEdit = (song) => {
    editingSong.value = song;
    editForm.value = { title: song.title, url: song.url };
};

const handleRefresh = async () => {
    if (isRefreshing.value) return; // 防止连续点击

    isRefreshing.value = true;

    // 执行原有的 load 逻辑
    updateStatus.value = UpdateStatus.WAITING;

    // 动画结束后重置状态
    setTimeout(() => {
        isRefreshing.value = false;
    }, 600);
};

// 保存逻辑
const saveEdit = async (updatedData) => {
    // 检查传进来的 updatedData 是否有值
    if (!updatedData || !updatedData.title || !updatedData.url) return;

    const song = editingSong.value;
    if (!song) return;
    // 编辑操作只作用于 queued 中的歌曲（与后端语义对齐）
    const index = queued.value.findIndex(s => s.id === song.id);
    const oldData = { title: song.title, url: song.url };

    // 乐观更新UI
    song.title = updatedData.title;
    song.url = updatedData.url;

    if (index !== -1) {
        const success = await commitOp({
            song: song, toIndex: index // 原位覆盖更新（queued 内索引）
        });
        if (!success) {
            // 失败回退
            song.title = oldData.title;
            song.url = oldData.url;
        }
    }
    editingSong.value = null;
};

const saveNickname = () => {
    if (tempNickname.value.trim()) {
        cfg.value.nickname = tempNickname.value.trim();
        tempNickname.value = null;
        showNicknameModal.value = false;
    }
};

let socket = null;
let pollingTimer = null;
let reconnectTimer = null;
let pingTimer = null;

// 停止所有同步
const stopSyncDrivers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearTimeout(pingTimer);
    if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
        console.log("WebSocket disconnected")
    }
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        console.log("Interval HTTP disabled")
    }
};

// WebSocket
const initWebSocket = () => {
    socket = new WebSocket(wsUrl);
    currentSync.value = SyncStatus.WS_CONNECTING;
    console.log("WebSocket connecting...");

    socket.onopen = () => {
        currentSync.value = SyncStatus.WS_ONLINE;
        console.log("WebSocket connected");
        pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "ping" }));// 发送 ping
            }
        }, 20000); // 每 20 秒发送一次 ping
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            // 当服务端通知更新，且 Hash 与本地不一致时 load
            if (data.type === 'UPDATE' && data.hash !== lastHash.value) {
                if (updateStatus.value !== UpdateStatus.WAITING && updateStatus.value !== UpdateStatus.FETCHING) {
                    updateStatus.value = UpdateStatus.WAITING;
                }
            }
        } catch (e) {
            console.error("WS Message Error:", e);
        }
    };

    socket.onclose = () => {
        currentSync.value = SyncStatus.OFFLINE;
        console.warn('WS 连接已断开，3秒后尝试重连...');
        reconnectTimer = setTimeout(initWebSocket, 3000);
    };

    socket.onerror = (err) => {
        showTransientStatus(SyncStatus.FAILED);
        console.error('WS 发生错误:', err);
    };
};

// HTTP轮询
const initPolling = () => {
    if (pollingTimer) return;
    currentSync.value = SyncStatus.POLLING_IDLE;
    pollingTimer = setInterval(() => {
        // 轮询也只是改变状态，触发你的状态机
        updateStatus.value = UpdateStatus.WAITING;
    }, 5000);
    console.log("Interval HTTP enabled")
};

// 监听模式变化，切换驱动源
watch(() => cfg.value.wsMode, (isWS) => {
    if (roomNotFound.value) return;
    stopSyncDrivers();
    if (isWS) {
        initWebSocket();
    } else {
        initPolling();
    }
});

onMounted(async () => {
    // 房间存在性校验：不存在则进入“房间不存在”全屏状态
    try {
        const res = await fetch(`api/roomExists?roomId=${encodeURIComponent(roomId.value ?? '')}`).then(r => r.json());
        if (!res.exists) {
            roomNotFound.value = true;
            return;
        }
    } catch (e) {
        // 网络异常时按房间存在处理，避免误报
        console.error('Room Exists Check Error:', e);
    }

    if (!cfg.value.nickname) showNicknameModal.value = true;

    // 首次进入：触发状态机拉取数据
    updateStatus.value = UpdateStatus.WAITING;

    // 根据模式启动对应的驱动
    if (cfg.value.wsMode) {
        initWebSocket();
    } else {
        initPolling();
    }
});

onUnmounted(() => {
    stopSyncDrivers();
});

</script>

<template>
    <div class="brand-theme">

    <div v-if="roomNotFound" class="room-not-found-overlay">
        <div class="room-not-found-card">
            <div class="inline-block relative">
                <img
                    src="/exclamation.svg"
                    class="absolute -left-9 top-2 w-10 h-10 object-contain"
                    alt=""
                />
                <h1 class="text-3xl font-black text-slate-800 mb-1">KTV Queue</h1>
                <div class="h-1 w-full bg-[var(--brand-color)] rounded-full"></div>
            </div>

            <h2 class="room-not-found-title">房间不存在或已失效</h2>
            <p class="room-not-found-desc">房间可能已被删除，或链接已失效。请返回首页重新创建或加入房间。</p>

            <ComfirmButton
                type="primary"
                class="w-full mt-8"
                @click="backHome()"
            >
                返回首页
            </ComfirmButton>
        </div>
    </div>

    <header class="mb-6">
        <div class="flex justify-between items-start">
            <h1 @click="backHome()" class="brand-title cursor-pointer">KTV<br/>Queue</h1>
            <div class="flex flex-col items-end gap-2">
            <div class="flex gap-2">
                <button @click="cfg.hostMode = !cfg.hostMode"
                        :class="['btn-host', cfg.hostMode ? 'active' : 'inactive']">
                    <span :class="['dot-status', cfg.hostMode ? 'bg-green-400 animate-pulse' : 'bg-slate-300']"></span>
                    主机模式 {{ cfg.hostMode ? 'ON' : 'OFF' }}
                </button>
                <button @click="showFavoritesModal = true" class="btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                    </svg>
                </button>
                <button type="button" class="btn-icon" aria-label="帮助" title="帮助" @click="openHelp">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-1"></path>
                        <path d="M12 13c0-2 3-2.2 3-5a3 3 0 1 0-6 0"></path>
                    </svg>
                </button>
                <button @click="showSettings = true"
                        class="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 transition">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>

            <div class="flex flex-col items-end gap-1">
                <div :class="['px-2 py-0.5 rounded-xl border flex items-center gap-1.5 transition-all shadow-sm',
                currentSync === SyncStatus.SUCCESS ? 'bg-emerald-50 border-emerald-200' :
                currentSync === SyncStatus.FAILED ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200']">
                    <span class="relative flex h-1.5 w-1.5">
                        <span v-if="currentSync.dot.includes('animate')"
                              :class="['absolute inline-flex h-full w-full rounded-full opacity-75', currentSync.dot]"></span>
                        <span :class="['relative inline-flex rounded-full h-1.5 w-1.5', currentSync.dot]"></span>
                    </span>
                    <span :class="['sync-label', currentSync.color]">
                        {{ currentSync.label }}
                    </span>
                </div>
            </div>
            </div>
        </div>
        <div class="mt-2">
            <div class="flex items-center gap-2">
                <p class="text-sub">房间ID: {{ roomId }}</p>
                <button
                    type="button"
                    class="cursor-pointer"
                    :class="['copy-link-btn', { copied: copyLinkStatus }]"
                    :aria-label="copyLinkStatus || '复制房间链接'"
                    :title="copyLinkStatus || '复制房间链接'"
                    @click.stop="copyRoomLink"
                >
                    <svg
                        v-if="!copyLinkStatus"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <svg
                        v-else
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 6 9 17l-5-5"></path>
                    </svg>
                    <span>{{ copyLinkStatus ? '已复制' : '分享' }}</span>
                </button>
            </div>
            <p class="copy-link-hint">{{ copyLinkStatus || '复制后可发到聊天软件，邀请别人来点歌' }}</p>
        </div>
    </header>

    <div class="mb-6">
        <div class="flex items-center justify-between mb-2 px-1">
            <span class="status-indicator-text">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-light opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                </span>
                正在播放
            </span>
        </div>
        <div @click="goToLink(singing)" class="now-playing-card group">
            <div class="flex-1 min-w-0 pr-4">
                <div class="now-playing-title truncate">
                    {{ singing?.title || "暂无在播歌曲" }}
                </div>
                <div class="flex items-center gap-1.5 mt-1.5">
                    <span class="user-badge">
                        {{ singing?.addedBy || "SYSTEM" }}
                    </span>
                    <div class="url-text truncate">{{ singing?.url || "" }}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="tab-container">
        <div class="tab-slider"
             :style="{ transform: activeTab === 'history' ? 'translateX(100%)' : 'translateX(0)' }">
        </div>
        <button @click="activeTab = 'queue'"
                :class="['tab-btn', activeTab === 'queue' ? 'active' : 'inactive']">
            待唱 ({{ queueList.length }})
        </button>
        <button @click="activeTab = 'history'"
                :class="['tab-btn', activeTab === 'history' ? 'active' : 'inactive']">
            已唱 ({{ historyList.length }})
        </button>
    </div>

    <!-- 待唱列表 -->
    <QueueList
        :active="activeTab === 'queue'"
        v-model:queueList="queueList"
        :is-favorited="isFavorited"
        :dragging="isDragging"
        @drag-start="isDragging = true"
        @end="isDragging = false"
        @drag-change="onDragChange"
        @go-to="goToLink"
        @toggle-favorite="toggleFavorite"
        @move-top="moveToTop"
        @edit="startEdit"
        @remove="remove"
    />

    <!-- 已唱列表 -->
    <HistoryList
        :active="activeTab === 'history'"
        :history-list="historyList"
        :is-favorited="isFavorited"
        @go-to="goToLink"
        @toggle-favorite="toggleFavorite"
        @undo="undoSung"
        @re-add="reAdd"
    />

    <NicknameModal
        v-model="showNicknameModal"
        v-model:tempNickname="tempNickname"
        :has-nickname="!!cfg.nickname"
        @save="saveNickname"
    />

    <AddSongModal
        v-model="showAddModal"
        v-model:isAddingToFavorites="isAddingToFavorites"
        v-model:searchKeyword="biliSearchKeyword"
        v-model:autoInput="autoInput"
        v-model:form="form"
        :search-loading="biliSearchLoading"
        @auto-recognize="handleAutoRecognize($event, form)"
        @search="searchBilibiliSongs"
        @toggle-parts="toggleBilibiliParts"
        @select-result="addBilibiliSearchResult"
        @select-part="addBilibiliPart"
        @submit="handleAdd"
    />

    <BilibiliSearchModal
        v-model="showBiliSearchModal"
        v-model:searchKeyword="biliSearchKeyword"
        :search-loading="biliSearchLoading"
        :search-results="biliSearchResults"
        :expanded-bvid="expandedBvid"
        @search="searchBilibiliSongs"
        @toggle-parts="toggleBilibiliParts"
        @select-result="addBilibiliSearchResult"
        @select-part="addBilibiliPart"
        @preview="previewBilibiliSearchResult"
    />

    <EditSongModal
        v-model="editingSong"
        @save="saveEdit"
    />

    <DeleteConfirmModal
        v-model="deletingSong"
        @confirm="confirmDelete"
    />

    <JumpConfirmModal
        v-model="pendingJumpUrl"
        :song-title="jumpSongTitle"
        @confirm="confirmJump"
    />

    <FavoritesModal
        v-model="showFavoritesModal"
        v-model:searchQuery="favSearchQuery"
        :favorites="favorites"
        :filteredFavorites="filteredFavorites"
        @add-new="isAddingToFavorites = true; editingSong = null; showAddModal = true"
        @edit="startEdit"
        @remove="toggleFavorite"
        @enqueue="addFavoriteToQueue"
        @export="exportFavorites"
        @import="handleImportFile"
        @go-to="goToLink"
    />

    <SettingsModal
        v-model="showSettings"
        v-model:cfg="cfg"
    />

    <ShuffleConfirmModal
        v-model="showShuffleConfirm"
        @confirm="shuffleSongs"
    />

    <!-- 全局操作失败提示 -->
    <Toast :message="toastMsg" />

    <!--    底部导航栏       -->
    <BottomNav
        :is-refreshing="isRefreshing"
        :history-empty="historyList.length === 0"
        :queue-empty="queueList.length === 0"
        :singing-empty="!singing"
        @refresh="handleRefresh"
        @undo="undoSung"
        @add="showAddModal = true"
        @prev="prevSong"
        @next="nextSong"
        @shuffle="showShuffleConfirm = true"
    />


    <div class="h-24"></div>
    </div>
</template>
<style>
:root {
    /* 核心色：FF3377 */
    --brand-color: #FF3377;
    --brand-color-rgb: 255, 51, 119;
    --brand-color-dark: #E62E6B;
    --brand-color-light: #FFD6E4;
    --brand-color-lighter: #FFF5FA;
    --brand-color-bg: #FEFEFC;
    --brand-color-bd: #FEFEFC;

    /* 基础辅助色 */
    --text-main: #334155;
    --text-sub: #94a3b8;
    --border-base: #e2e8f0;
    --bg-light: #FEFEFC;

    --danger-color: #ef4444;
    --danger-bg: #fef2f2;
}
</style>
<style scoped>
@reference "tailwindcss";

/* 2. 基础文字样式 */
.brand-title {
    @apply text-3xl font-black transition-colors;
    color: var(--brand-color);
}

.text-sub {
    color: var(--text-sub);
}

.copy-link-btn {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black shadow-sm transition-all;
    background-color: var(--brand-color-lighter);
    color: var(--text-sub);
    border-color: var(--brand-color-light);
}

.copy-link-btn:hover {
    color: var(--brand-color);
    transform: translateY(-1px);
    box-shadow: 0 8px 18px -12px rgba(var(--brand-color-rgb), 0.7);
}

.copy-link-btn.copied {
    background-color: var(--brand-color);
    border-color: var(--brand-color);
    color: white;
}

.copy-link-hint {
    @apply mt-1 text-[10px] transition-colors;
    color: var(--text-sub);
}

/* 3. 按钮组件化 */
.btn-host {
    @apply px-3 py-2 rounded-xl border transition text-[10px] font-black flex items-center gap-1.5;
}
.btn-host.active {
    @apply text-white shadow-md;
    background-color: var(--brand-color);
    border-color: var(--brand-color);
}
.btn-host.inactive {
    @apply bg-white border-slate-200 text-slate-400;
}

.btn-icon {
    @apply p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 transition;
}
.btn-icon:hover {
    color: var(--brand-color);
}

.dot-status {
    @apply w-1.5 h-1.5 rounded-full;
}

/* 4. 同步状态标签 */
.sync-badge {
    @apply px-2 py-0.5 rounded-xl border flex items-center gap-1.5 transition-all shadow-sm;
}
.sync-label {
    @apply text-[9px] font-black uppercase tracking-tighter;
}

/* 5. 正在播放卡片 */
.status-indicator-text {
    @apply text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5;
    color: var(--text-sub);
}
.bg-brand { background-color: var(--brand-color); }
.bg-brand-light { background-color: var(--brand-color-light); }

.now-playing-card {
    @apply border p-4 rounded-3xl flex items-center transition-all active:scale-95 cursor-pointer;
    background-color: var(--brand-color-lighter);
    border-color: var(--brand-color-light);
}

.now-playing-title {
    @apply text-sm font-bold leading-tight transition;
    color: var(--text-main);
}
.now-playing-card:hover .now-playing-title {
    color: var(--brand-color);
}

.user-badge {
    @apply shrink-0 text-[9px] px-1.5 py-0.5 bg-white rounded font-bold border;
    color: var(--brand-color);
    border-color: var(--brand-color-light);
}

.url-text {
    @apply text-[10px] opacity-70;
    color: var(--text-sub);
}

/* 6. Tab 切换组件 */
.tab-container {
    @apply mb-6 flex p-1 rounded-2xl relative border;
    border-color: var(--brand-color-light);
    background-color: var(--bg-light);
}

.tab-slider {
    @apply absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,1.2,0.3,1)];
}

.tab-btn {
    @apply relative z-10 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200;
}
.tab-btn.active {
    color: var(--brand-color);
}
.tab-btn.inactive {
    @apply text-slate-400 hover:text-slate-600;
}

/* 7. 房间不存在全屏状态（贴合 Home 卡片质感） */
.room-not-found-overlay {
    @apply fixed inset-0 z-50 flex items-center justify-center p-4;
    background-color: var(--brand-color-bg);
}

.room-not-found-card {
    @apply w-full max-w-sm bg-[#FEFEFC]/95 backdrop-blur-sm p-8 rounded-xl border-4 border-slate-100 shadow-2xl text-center;
    animation: roomFadeUp 0.5s ease-out;
}

.room-not-found-title {
    @apply mt-8 text-2xl font-black;
    color: var(--text-main);
}

.room-not-found-desc {
    @apply mt-3 text-sm font-bold leading-relaxed;
    color: var(--text-sub);
}

@keyframes roomFadeUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
