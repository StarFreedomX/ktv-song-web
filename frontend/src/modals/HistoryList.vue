<template>
    <div v-show="active">
        <div v-for="element in processedHistory" :key="element.id"
             class="song-card bg-slate-50/50 mb-2 px-5 py-3 rounded-2xl border border-slate-200 flex items-center group opacity-90">

            <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('go-to', element)">
                <div class="text-sm font-bold text-slate-500 truncate group-hover:text-indigo-600 transition">
                    {{ element.title }}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
          <span v-if="element.addedBy" class="shrink-0 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-medium">
            {{ element.addedBy }}
          </span>
                    <div class="text-[10px] text-slate-300 truncate">{{ element.url }}</div>
                </div>
            </div>

            <div class="flex items-center">
                <button @click.stop="$emit('toggle-favorite', element)"
                        :class="['p-2 transition', isFavorited(element) ? 'text-red-500' : 'text-slate-300 hover:text-red-400']"
                        title="收藏">
                    <svg width="15" height="15" viewBox="0 0 24 24" :fill="isFavorited(element) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                    </svg>
                </button>

                <button @click.stop="$emit('undo', element)"
                        class="mr-2 p-2 text-slate-300 hover:text-indigo-500 transition"
                        title="撤回到待唱顶部">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6-6M3 10l6 6"/>
                    </svg>
                </button>

                <button @click="$emit('re-add', element)"
                        class="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg active:bg-indigo-600 active:text-white transition-colors group">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span class="text-[10px] font-bold">再唱</span>
                </button>
            </div>
        </div>

        <div v-if="historyList.length <= 1" class="text-center py-20 text-slate-300 text-sm">
            暂无更多历史记录
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    active: Boolean,      // 当前 Tab 是否选中
    historyList: Array,   // 原始历史列表
    isFavorited: Function // 判断是否收藏的函数
});

const emit = defineEmits(['go-to', 'toggle-favorite', 'undo', 're-add']);

// 内部处理逻辑：倒序显示已唱历史（后端已把 singing 与 sung 区分开）
const processedHistory = computed(() => {
    return props.historyList.slice().reverse();
});
</script>
