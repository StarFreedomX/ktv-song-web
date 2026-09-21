<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ComfirmButton from './modals/components/ComfirmButton.vue';
import { fetchArchive, formatDate, isUuid, readRoomHistory, rememberRoom } from './roomHistory';

const rooms = ref([]);
const selected = ref([]);
const input = ref('');
const message = ref('');
const busy = ref(false);
const copying = ref(false);
const exportText = computed(() => selected.value.join('\n') + '\n');
const allSelected = computed(() => rooms.value.length > 0 && selected.value.length === rooms.value.length);
function reload() {
    try {
        rooms.value = readRoomHistory();
        selected.value = selected.value.filter(uuid => rooms.value.some(room => room.uuid === uuid));
    } catch { message.value = '无法读取历史房间，请检查浏览器本地存储。'; }
}
onMounted(() => { reload(); window.addEventListener('storage', reload); });
onUnmounted(() => window.removeEventListener('storage', reload));

async function importRooms() {
    if (busy.value) return;
    const uuids = [...new Set(input.value.trim().split(/[\s,，;；]+/).filter(Boolean).map(uuid => uuid.toLowerCase()))];
    if (!uuids.length || uuids.some(uuid => !isUuid(uuid))) {
        message.value = '请输入有效的 UUID，多个 UUID 用换行或逗号分隔。';
        return;
    }
    busy.value = true;
    message.value = '正在导入…';
    const failed = [];
    let count = 0;
    for (const uuid of uuids) {
        try {
            const archive = await fetchArchive(uuid);
            rememberRoom({ uuid, roomId: archive.roomId, createdAt: archive.createdAt });
            count++;
        } catch (error) { failed.push({ uuid, reason: error.message }); }
    }
    reload();
    input.value = failed.map(item => item.uuid).join('\n');
    message.value = `已导入 ${count} 个房间。${failed.length ? `${failed.length} 个失败：${failed[0].reason}。失败 UUID 已保留，可重试。` : ''}`;
    busy.value = false;
}

function exportRooms() {
    if (!selected.value.length) return;
    const blob = new Blob([exportText.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ktv-room-history.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = `已导出 ${selected.value.length} 个房间 UUID，可复制文件内容导入。`;
}

async function copyRooms() {
    if (!selected.value.length || copying.value) return;
    const text = exportText.value;
    const count = selected.value.length;
    copying.value = true;
    try {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // 局域网 HTTP 等环境可能没有 Clipboard API，回退到浏览器复制命令。
            const previousFocus = document.activeElement;
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(textarea);
            try {
                textarea.select();
                textarea.setSelectionRange(0, text.length);
                if (!document.execCommand('copy')) throw new Error('Copy failed');
            } finally {
                textarea.remove();
                previousFocus?.focus();
            }
        }
        message.value = `已复制 ${count} 个房间 UUID 到剪贴板，可直接粘贴导入。`;
    } catch {
        message.value = '复制失败，请检查浏览器剪贴板权限，或使用“导出到文件”。';
    } finally {
        copying.value = false;
    }
}
</script>

<template>
    <main class="min-h-screen p-4 sm:p-8">
        <div class="max-w-2xl mx-auto bg-[#FEFEFC]/95 backdrop-blur-sm rounded-xl border-4 border-slate-100 shadow-2xl p-5 sm:p-8">
            <RouterLink to="/history" class="text-sm font-bold text-slate-500 hover:text-[#FE3C71]">← 返回历史房间</RouterLink>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-800 mt-5">导入 / 导出房间</h1>
            <div class="h-1 w-14 bg-[#FE3C71] rounded-full mt-3"></div>
            <p class="text-sm text-slate-500 mt-4">通过 UUID 导入房间，或导出所选记录，在其他设备继续查看。</p>

            <form class="mt-6 space-y-3" @submit.prevent="importRooms">
                <label for="room-uuids" class="block text-sm font-bold text-slate-700">通过 UUID 导入房间</label>
                <textarea id="room-uuids" v-model="input" :disabled="busy" rows="3" placeholder="粘贴 UUID，多个可用换行或逗号分隔" class="w-full min-w-0 resize-y p-4 bg-[#DDDDDB] rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#FE3C71]/30"></textarea>
                <ComfirmButton class="px-4 disabled:opacity-50 disabled:cursor-not-allowed" type="primary" :disabled="busy || !input.trim()" @click="importRooms">{{ busy ? '导入中…' : '导入房间' }}</ComfirmButton>
            </form>
            <p v-if="message" role="status" class="mt-4 text-sm text-slate-600 break-words">{{ message }}</p>

            <h2 class="mt-8 text-lg font-black text-slate-700">导出历史房间</h2>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label class="flex items-center gap-2 text-sm font-bold text-slate-600 py-2">
                    <input type="checkbox" :checked="allSelected" :disabled="!rooms.length" class="accent-[#FE3C71] w-4 h-4" @change="selected = $event.target.checked ? rooms.map(room => room.uuid) : []">
                    全选（{{ rooms.length }}）
                </label>
                <span class="text-sm text-slate-400">已选 {{ selected.length }} 个房间</span>
            </div>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComfirmButton class="px-4 disabled:opacity-50 disabled:cursor-not-allowed" type="secondary" :disabled="!selected.length" @click="exportRooms">导出到文件</ComfirmButton>
                <ComfirmButton class="px-4 disabled:opacity-50 disabled:cursor-not-allowed" type="secondary" :disabled="!selected.length || copying" @click="copyRooms">{{ copying ? '复制中…' : '导出到剪贴板' }}</ComfirmButton>
            </div>
            <p v-if="!rooms.length" class="py-12 text-center text-sm text-slate-400">暂无历史房间，加入房间或导入 UUID 后会显示在这里。</p>
            <ul v-else class="mt-4 space-y-3">
                <li v-for="room in rooms" :key="room.uuid" class="flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 bg-white">
                    <input v-model="selected" type="checkbox" :value="room.uuid" :aria-label="`选择房间 ${room.roomId || room.uuid}`" class="w-4 h-4 shrink-0 accent-[#FE3C71]">
                    <RouterLink :to="{ name: 'RoomArchive', params: { uuid: room.uuid } }" class="min-w-0 flex-1 group">
                        <p class="font-bold text-slate-700 group-hover:text-[#FE3C71] break-all">房间 {{ room.roomId || '未知' }} <span class="text-sm">→</span></p>
                        <p class="text-[11px] text-slate-400 break-all mt-1">{{ room.uuid }}</p>
                        <p class="text-xs text-slate-400 mt-2">记录于 {{ formatDate(room.savedAt) }}</p>
                    </RouterLink>
                </li>
            </ul>
        </div>
    </main>
</template>
