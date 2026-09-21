<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { formatDate, readRoomHistory } from './roomHistory';

const rooms = ref([]);
const message = ref('');
function reload() {
    try {
        rooms.value = readRoomHistory();
        message.value = '';
    } catch { message.value = '无法读取历史房间，请检查浏览器本地存储。'; }
}
onMounted(() => { reload(); window.addEventListener('storage', reload); });
onUnmounted(() => window.removeEventListener('storage', reload));
</script>

<template>
    <main class="min-h-screen p-4 sm:p-8">
        <div class="max-w-2xl mx-auto bg-[#FEFEFC]/95 backdrop-blur-sm rounded-xl border-4 border-slate-100 shadow-2xl p-5 sm:p-8">
            <RouterLink to="/" class="text-sm font-bold text-slate-500 hover:text-[#FE3C71]">← 返回主页</RouterLink>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-800 mt-5">历史房间记录</h1>
            <div class="h-1 w-14 bg-[#FE3C71] rounded-full mt-3"></div>
            <p class="text-sm text-slate-500 mt-4">回到曾经加入的房间，查看历史歌单。</p>

            <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm font-bold text-slate-500">已记录 {{ rooms.length }} 个房间</p>
                <RouterLink to="/history/transfer" class="rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500 hover:text-[#FE3C71] transition-colors">导入 / 导出</RouterLink>
            </div>
            <p v-if="message" role="status" class="mt-4 text-sm text-slate-600 break-words">{{ message }}</p>
            <p v-else-if="!rooms.length" class="py-12 text-center text-sm text-slate-400">暂无历史房间，加入房间后会自动记录在这里。</p>
            <ul v-else class="mt-4 space-y-3">
                <li v-for="room in rooms" :key="room.uuid">
                    <RouterLink :to="{ name: 'RoomArchive', params: { uuid: room.uuid } }" class="group flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 bg-white hover:border-[#FE3C71]/20 transition-colors">
                        <div class="min-w-0 flex-1">
                            <p class="font-bold text-slate-700 group-hover:text-[#FE3C71] break-all">房间 {{ room.roomId || '未知' }}</p>
                            <p class="text-[11px] text-slate-400 break-all mt-1">{{ room.uuid }}</p>
                            <p class="text-xs text-slate-400 mt-2">记录于 {{ formatDate(room.savedAt) }}</p>
                        </div>
                        <span aria-hidden="true" class="shrink-0 text-slate-400 group-hover:text-[#FE3C71]">→</span>
                    </RouterLink>
                </li>
            </ul>
        </div>
    </main>
</template>
