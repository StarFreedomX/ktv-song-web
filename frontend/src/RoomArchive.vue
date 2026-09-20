<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ComfirmButton from './modals/components/ComfirmButton.vue';
import { fetchArchive, formatDate, isUuid } from './roomHistory';

const route = useRoute();
const router = useRouter();
const archive = ref(null);
const loading = ref(false);
const joining = ref(false);
const error = ref('');
let requestId = 0;
const initialLoading = computed(() => loading.value && !archive.value);
const sections = computed(() => archive.value ? [
    { title: '正在唱', songs: archive.value.songLists.singing ? [archive.value.songLists.singing] : [] },
    { title: '待唱歌曲', songs: archive.value.songLists.queued || [] },
    { title: '已唱歌曲', songs: archive.value.songLists.sung || [] }
] : []);

async function load() {
    const id = ++requestId;
    const uuid = route.params.uuid;
    loading.value = true;
    error.value = '';
    try {
        if (!isUuid(uuid)) throw new Error('无效的房间 UUID');
        const data = await fetchArchive(uuid.toLowerCase());
        if (id === requestId) archive.value = data;
    } catch (err) { if (id === requestId) error.value = err.message || '无法读取存档，请稍后重试'; }
    finally { if (id === requestId) loading.value = false; }
}
watch(() => route.params.uuid, () => {
    // 只有切换房间才清空旧数据；刷新保留已有节点和页面高度。
    archive.value = null;
    load();
}, { immediate: true });
onUnmounted(() => { requestId++; });

async function join() {
    if (joining.value) return;
    joining.value = true;
    error.value = '';
    try {
        const { roomId, uuid } = archive.value;
        const res = await fetch(`/api/roomExists?roomId=${encodeURIComponent(roomId)}&uuid=${encodeURIComponent(uuid)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || '服务暂不可用，请稍后重试');
        if (!data.exists) {
            archive.value.active = false;
            throw new Error('该房间已关闭，仍可查看历史歌单');
        }
        router.push({ name: 'Room', query: { roomId } });
    } catch (err) { error.value = err.message; }
    finally { joining.value = false; }
}
</script>

<template>
    <main class="min-h-screen p-4 sm:p-8">
        <div :aria-busy="loading" class="max-w-3xl mx-auto bg-[#FEFEFC]/95 backdrop-blur-sm rounded-xl border-4 border-slate-100 shadow-2xl p-5 sm:p-8">
            <RouterLink to="/history" class="text-sm font-bold text-slate-500 hover:text-[#FE3C71]">← 历史房间记录</RouterLink>
            <div class="flex flex-wrap justify-between items-center gap-3 mt-5">
                <h1 class="text-2xl sm:text-3xl font-black text-slate-800 break-all">
                    <template v-if="archive">房间 {{ archive.roomId }}</template>
                    <template v-else-if="initialLoading">
                        <span class="sr-only">正在读取房间</span>
                        <span aria-hidden="true" class="archive-skeleton block h-8 sm:h-9 w-40 rounded-lg"></span>
                    </template>
                    <template v-else>历史房间</template>
                </h1>
                <span class="text-xs font-bold text-[#FE3C71] bg-[#FE3C71]/10 px-3 py-1.5 rounded-full">只读存档</span>
            </div>
            <p class="text-[11px] text-slate-400 break-all mt-2">UUID: {{ route.params.uuid }}</p>
            <div class="h-1 w-14 bg-[#FE3C71] rounded-full mt-4"></div>
            <p role="status" class="sr-only">{{ loading ? (archive ? '正在刷新房间，当前显示上次读取的歌单' : '正在读取房间') : '' }}</p>
            <p v-if="error" role="alert" class="mt-5 text-sm text-red-500">{{ error }}</p>
            <div class="flex flex-wrap items-center gap-3 mt-5">
                <ComfirmButton class="px-4 disabled:opacity-50 disabled:cursor-not-allowed" v-if="archive?.active" type="primary" :disabled="joining || loading" @click="join">{{ joining ? '正在进入…' : '进入活跃房间' }}</ComfirmButton>
                <ComfirmButton class="px-4 disabled:opacity-50 disabled:cursor-not-allowed" type="secondary" :aria-label="loading ? '正在刷新' : '刷新'" :disabled="loading || joining" @click="load">
                    <span class="relative inline-block">
                        <span :class="{ invisible: loading }">刷新</span>
                        <span v-show="loading" aria-hidden="true" class="archive-skeleton absolute inset-0 rounded"></span>
                    </span>
                </ComfirmButton>
                <span v-if="archive" class="text-sm text-slate-500">{{ archive.active === null ? '暂时无法确认房间状态，请稍后刷新' : archive.active ? '房间仍在活跃中' : '房间已关闭' }}</span>
            </div>
            <div v-if="initialLoading" aria-hidden="true">
                <div class="mt-4 space-y-2">
                    <div class="archive-skeleton h-3 w-48 max-w-full rounded"></div>
                    <div class="archive-skeleton h-3 w-48 max-w-full rounded"></div>
                </div>
                <div v-for="section in 3" :key="section" class="mt-8">
                    <div class="archive-skeleton h-7 w-28 rounded"></div>
                    <div class="mt-3 p-4 rounded-xl border-2 border-slate-100 space-y-3">
                        <div class="archive-skeleton h-5 w-3/4 rounded"></div>
                        <div class="archive-skeleton h-3 w-1/3 rounded"></div>
                        <div class="archive-skeleton h-3 w-2/3 rounded"></div>
                    </div>
                </div>
            </div>
            <template v-if="archive">
                <div class="mt-4 text-xs text-slate-400 space-y-1">
                    <p>创建时间：{{ formatDate(archive.createdAt) }}</p>
                    <p>最后更新：{{ formatDate(archive.updatedAt) }}</p>
                </div>
                <section v-for="section in sections" :key="section.title" class="mt-8">
                    <h2 class="text-lg font-black text-slate-700">{{ section.title }} <span class="text-sm text-slate-400">{{ section.songs.length }}</span></h2>
                    <p v-if="!section.songs.length" class="text-sm text-slate-400 py-5">暂无歌曲</p>
                    <ol v-else class="mt-3 space-y-3">
                        <li v-for="(song, index) in section.songs" :key="song.id" class="flex gap-3 p-4 bg-white rounded-xl border-2 border-slate-100">
                            <span class="text-sm text-slate-400 font-bold shrink-0">{{ index + 1 }}</span>
                            <div class="min-w-0">
                                <p class="font-bold text-slate-700 break-words">{{ song.title }}</p>
                                <p v-if="song.addedBy" class="text-xs text-slate-400 mt-1 break-words">点歌人：{{ song.addedBy }}</p>
                                <p class="text-[11px] text-slate-400 break-all mt-2 select-all">{{ song.url }}</p>
                            </div>
                        </li>
                    </ol>
                </section>
            </template>
        </div>
    </main>
</template>

<style scoped>
.archive-skeleton {
    background: #e2e8f0;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
}
@keyframes skeleton-pulse {
    50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
    .archive-skeleton { animation: none; }
}
</style>
