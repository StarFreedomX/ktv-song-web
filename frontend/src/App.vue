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
import NicknameModal from "./modals/NicknameModal.vue";
import BottomNav from "./modals/BottomNav.vue";
import QueueList from "./modals/QueueList.vue";
import HistoryList from "./modals/HistoryList.vue";

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
const roomIdFromUrl = route.params.roomId;
const roomId = ref(roomIdFromUrl);

// 修改页面标题
if (roomId.value) {
    document.title = `KTV 房间 - ${roomId.value}`;
}

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
    wsMode: localData.wsMode ?? (localStorage.getItem('ktv_ws_mode') !== 'false')
});

// api接口
const lastHash = ref(EMPTY_HASH);
const commitApiUrl = "api/songOperation"
const loadSongListUrl = "api/songListInfo"
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
const currentSync = ref(SyncStatus.WS_CONNECTING);

// 存储
/** @type {import('vue').Ref<Song[]>} */
const songs = ref([]);
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
    getLISIndices
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

//监听器
// 逻辑拆分：待唱列表和已唱列表
const queueList = computed({
    get: () => songs.value.filter(s => !s.state || s.state === 'queued'), set: (newList) => {
        const history = songs.value.filter(s => s.state === 'sung');
        songs.value = [...newList, ...history];
    }
});
const historyList = computed(() => songs.value.filter(s => s.state === 'sung'));
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

// 监听正在播放歌曲的变化
watch(() => historyList.value[historyList.value.length - 1], (newSong, oldSong) => {
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
}, { deep: true });
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
                idArrayHash: lastHash.value, // 这个 Hash 现在代表了旧列表的内容+顺序
                toIndex: opData.toIndex, song: cleanSong
            })
        }).then(r => r.json());

        if (res.success) {
            if (await getHash(songs.value) !== res.hash) {
                // console.log(songs.value, await getHash(songs.value))
                updateStatus.value = UpdateStatus.WAITING;
            } else {
                lastHash.value = res.hash;
                updateStatus.value = UpdateStatus.IDLE
            }
            if (res.song && opData.song) {
                const localSong = songs.value.find(s => s.id === opData.song.id);
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
        showAddModal.value = false;
        isAddingToFavorites.value = false; // 重置状态
        // 重置表单
        form.value.title = '';
        form.value.url = '';
    } else {
        // 原有的添加待唱列表逻辑
        await add();
    }
    showAddModal.value = false;
    autoInput.value = ''; // 清空识别框
};

const reAdd = async (song) => {
    form.value.title = song.title;
    form.value.url = song.url;
    await handleAdd();
};

const add = async () => {
    let rawUrl = form.value.url.trim();
    if (!form.value.title || !rawUrl) return;

    // 计算有效长度（排除正在删除的）
    const effectiveLen = songs.value.filter(s => !s.isDeleting && s.state !== "sung").length;

    const newSong = {
        id: 's-' + Math.random().toString(36).slice(2, 11),
        title: form.value.title,
        url: rawUrl,
        addedBy: cfg.value.nickname,
        isNew: true
    };

    // songs.value.push(newSong);
    songs.value.splice(effectiveLen, 0, newSong);
    form.value = { title: '', url: '' };

    setTimeout(() => {
        const target = songs.value.find(s => s.id === newSong.id);
        if (target) target.isNew = false;
    }, 600);

    const success = await commitOp({
        song: newSong, toIndex: effectiveLen // 使用排除删除项后的索引
    });
    if (!success) updateStatus.value = UpdateStatus.WAITING;
}

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
        songs.value = songs.value.filter(s => s.id !== songObj.id);
        await commitOp({
            song: songObj, toIndex: -1
        });
    }, 400); // 调整为 400ms 以匹配 CSS 坍塌速度
};

const moveToTop = async (song) => {
    // 如果已经在第一位，无需操作
    if (queueList.value[0]?.id === song.id) return;

    // 这里的逻辑与 load 中的“主动移动”一致
    const oldIndex = songs.value.findIndex(s => s.id === song.id);
    if (oldIndex === -1) return;

    song.isDeleting = true;

    setTimeout(async () => {
        // 从原位置移除
        const [movedItem] = songs.value.splice(oldIndex, 1);
        // 插入到最前面 (待唱列表最前面)
        songs.value.unshift(movedItem);

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
    await commitOp({
        song: { ...song, state: 'queued' }, toIndex: 0
    });
};

const nextSong = async () => {
    const idx = songs.value.findIndex(s => !s.state || s.state === 'queued');
    if (idx === -1) return;
    const song = songs.value[idx];
    song.isDeleting = true;

    setTimeout(async () => {
        const currentIdx = songs.value.findIndex(s => s.id === song.id);
        if (currentIdx === -1) return;
        songs.value.splice(currentIdx, 1);
        const updatedSong = { ...song, state: 'sung' };
        delete updatedSong.isDeleting;
        songs.value.push(updatedSong);
        const success = await commitOp({ song: updatedSong, toIndex: songs.value.length - 1 });
        if (!success) updateStatus.value = UpdateStatus.WAITING;
    }, 400); // 与 slide-out-item 动画时长一致
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
    try {
        const url = `${loadSongListUrl}?roomId=${roomId.value}&lastHash=${(await getHash(songs.value))}`;
        const res = await fetch(url).then(r => r.json());

        if (res.changed) {
            const oldSongs = [...songs.value];
            const newSongsData = res.list || []; // 处理空返回

            // 如果新数据就是空的，直接赋值并更新 Hash，跳过后续复杂的 LIS 计算
            if (newSongsData.length === 0) {
                songs.value = [];
                lastHash.value = res.hash || EMPTY_HASH;
                return;
            }

            // 计算 ID 映射
            const oldIdMap = new Map();
            oldSongs.forEach((s, i) => {
                if (!s.isDeleting) oldIdMap.set(s.id, i);
            });

            // 识别“主动移动”的 ID
            const source = newSongsData.map(s => oldIdMap.has(s.id) ? oldIdMap.get(s.id) : -1);
            const lisIndices = new Set(getLISIndices(source));

            const activeMoveIds = new Set();
            newSongsData.forEach((s, newIdx) => {
                const oldIdx = oldIdMap.get(s.id);
                // 只有既不在 LIS 里、又不是真正的新歌，才是要处理的“改动元素”
                if (oldIdx !== undefined && oldIdx !== newIdx && !lisIndices.has(newIdx)) {
                    activeMoveIds.add(s.id);
                }
            });

            // 让删除项和“改动项”一起执行退出动画
            const newIdSet = new Set(newSongsData.map(s => s.id));
            oldSongs.forEach(s => {
                // 如果是服务器删了，或者它是主动移动项，执行退出
                if (!newIdSet.has(s.id) || activeMoveIds.has(s.id)) {
                    s.isDeleting = true;
                }
            });

            // 等待退出动画完成
            setTimeout(() => {
                // 构建最终列表
                songs.value = newSongsData.map((s, newIdx) => {
                    const oldIdx = oldIdMap.get(s.id);
                    const isNew = oldIdx === undefined;
                    const isActiveMove = activeMoveIds.has(s.id);

                    // 被动移动的判定（在 LIS 里但位置变了）
                    const isAffected = !isNew && !isActiveMove && oldIdx !== newIdx;

                    return {
                        ...s, // 入场动画
                        isMoved: isActiveMove, isNew: (isNew || isActiveMove), //&& oldSongs.length > 0,
                        isAffected: isAffected
                    };
                });

                setTimeout(() => {
                    songs.value.forEach(s => {
                        if (s.isNew) {
                            s.isNewActive = true;
                        }
                    });
                }, 10);

                lastHash.value = res.hash;

                // 清理状态
                setTimeout(() => {
                    songs.value.forEach(s => {
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
    const index = songs.value.findIndex(s => s.id === song.id);
    const oldData = { title: song.title, url: song.url };

    // 乐观更新UI
    song.title = updatedData.title;
    song.url = updatedData.url;

    if (index !== -1) {
        const success = await commitOp({
            song: song, toIndex: index // 原位覆盖更新
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

// 停止所有同步
const stopSyncDrivers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
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
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            // 当服务端通知更新，且 Hash 与本地不一致时 load
            if (data.type === 'UPDATE' && data.hash !== lastHash.value) {
                updateStatus.value = UpdateStatus.WAITING;
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
    stopSyncDrivers();
    if (isWS) {
        initWebSocket();
    } else {
        initPolling();
    }
});

onMounted(() => {
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

    <header class="mb-6 flex justify-between items-start">
        <div @click="backHome()" class="cursor-pointer group">
            <h1 class="text-3xl font-black text-indigo-600">KTV<br/>Queue</h1>
            <p class="text-slate-400">房间ID: {{ roomId }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
            <div class="flex gap-2">
                <button @click="cfg.hostMode = !cfg.hostMode"
                        :class="['px-3 py-2 rounded-xl border transition text-[10px] font-black flex items-center gap-1.5',
                     cfg.hostMode ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400']">
                    <span :class="['w-1.5 h-1.5 rounded-full', cfg.hostMode ? 'bg-green-400 animate-pulse' : 'bg-slate-300']"></span>
                    主机模式 {{ cfg.hostMode ? 'ON' : 'OFF' }}
                </button>
                <button @click="showFavoritesModal = true"
                        class="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 text-xs font-bold hover:text-indigo-600 transition flex items-center gap-1"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
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
                <div :class="['px-2 py-0.5 rounded-lg border flex items-center gap-1.5 transition-all shadow-sm',
                currentSync === SyncStatus.SUCCESS ? 'bg-emerald-50 border-emerald-200' :
                currentSync === SyncStatus.FAILED ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200']">

                <span class="relative flex h-1.5 w-1.5">
                    <span v-if="currentSync.dot.includes('animate')"
                          :class="['absolute inline-flex h-full w-full rounded-full opacity-75', currentSync.dot]"></span>
                    <span :class="['relative inline-flex rounded-full h-1.5 w-1.5', currentSync.dot]"></span>
                </span>

                    <span :class="['text-[9px] font-black uppercase tracking-tighter', currentSync.color]">
                    {{ currentSync.label }}
                </span>
                </div>
            </div>
        </div>
    </header>
    <div v-if="historyList.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-2 px-1">
    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        正在播放
    </span>
        </div>
        <div @click="goToLink(historyList[historyList.length - 1])"
             class="song-card bg-indigo-50 border border-indigo-100 p-4 rounded-3xl flex items-center group cursor-pointer transition-all active:scale-95">
            <div class="flex-1 min-w-0 pr-4">
                <div class="text-sm font-bold text-slate-700 truncate leading-tight group-hover:text-indigo-600 transition">
                    {{ historyList[historyList.length - 1].title }}
                </div>
                <div class="flex items-center gap-1.5 mt-1.5">
            <span v-if="historyList[historyList.length - 1].addedBy" class="shrink-0 text-[9px] px-1.5 py-0.5 bg-white text-indigo-500 rounded font-bold border border-indigo-100">
                {{ historyList[historyList.length - 1].addedBy }}
            </span>
                    <div class="text-[10px] text-slate-400 truncate opacity-70">{{ historyList[historyList.length - 1].url }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- 切换按钮 -->
    <div class="mb-6 flex p-1 bg-slate-100 rounded-2xl relative">
        <div class="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,1.2,0.3,1)]"
             :style="{ transform: activeTab === 'history' ? 'translateX(100%)' : 'translateX(0)' }">
        </div>
        <button @click="activeTab = 'queue'"
                :class="['relative z-10 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200',
                     activeTab === 'queue' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600']">
            待唱 ({{ queueList.length }})
        </button>
        <button @click="activeTab = 'history'"
                :class="['relative z-10 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200',
                     activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600']">
            已唱 ({{ historyList.length === 0 ? 0 : historyList.length - 1 }})
        </button>
    </div>

    <!-- 待唱列表 -->
    <QueueList
        :active="activeTab === 'queue'"
        v-model:queueList="queueList"
        :is-favorited="isFavorited"
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
        v-model:autoInput="autoInput"
        v-model:form="form"
        @auto-recognize="handleAutoRecognize($event, form)"
        @submit="handleAdd"
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

    <!--    底部导航栏       -->
    <BottomNav
        :is-refreshing="isRefreshing"
        :history-empty="historyList.length === 0"
        :queue-empty="queueList.length === 0"
        @refresh="handleRefresh"
        @undo="undoSung(historyList[historyList.length - 1])"
        @add="showAddModal = true"
        @next="nextSong"
        @shuffle="showShuffleConfirm = true"
    />


    <div class="h-24"></div>

</template>


