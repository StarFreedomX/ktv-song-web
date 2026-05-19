<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur"
             @click.self="handleClose">
            <div class="bg-white w-full max-w-3xl max-h-[92dvh] overflow-hidden rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-4 sm:p-6 flex flex-col gap-4">
                <div class="flex items-center justify-between px-2">
                    <div>
                        <h3 class="text-xl font-black text-slate-800">Bilibili 选歌</h3>
                        <div class="text-xs text-slate-400 font-semibold mt-0.5">
                            搜索结果仅供参考，受 API 限制；点击歌名可预览（默认 P1），预览跳转方式跟随「设置-跳转方式」
                        </div>
                    </div>
                    <button @click="handleClose"
                            class="flex items-center gap-1.5 px-3 border-1 py-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-all group">
                        <span class="text-xs font-bold">关闭</span>
                    </button>
                </div>

                <div class="flex flex-col sm:flex-row gap-2">
                    <input
                        name="bilibili_search_keyword"
                        autocomplete="on"
                        :value="searchKeyword"
                        @input="$emit('update:searchKeyword', $event.target.value)"
                        @keyup.enter="$emit('search')"
                        class="flex-1 px-4 py-3 bg-sky-50/60 rounded-2xl outline-none border-2 border-transparent focus:border-sky-200 transition text-sm"
                        placeholder="输入歌名或歌曲关键词"
                    >
                    <button
                        @click="$emit('search')"
                        class="shrink-0 px-5 py-3 rounded-2xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 transition disabled:opacity-50"
                        :disabled="searchLoading"
                    >
                        {{ searchLoading ? '搜索中' : '搜索' }}
                    </button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                    <div v-if="searchResults.length" class="space-y-3">
                        <div
                            v-for="item in searchResults"
                            :key="item.bvid"
                            class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
                        >
                            <div class="flex gap-4">
                                <img :src="item.pic" :alt="item.title" class="w-28 h-16 rounded-2xl object-cover bg-slate-200 shrink-0">
                                <div class="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        class="text-left text-base font-black text-slate-800 line-clamp-2 hover:text-indigo-600 transition"
                                        @click="$emit('preview', item)"
                                        :title="`预览：${item.title}`"
                                    >
                                        {{ item.title }}
                                    </button>
                                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-600">
                                        <div v-if="item.author" class="truncate">up: {{ item.author }}</div>
                                        <div class="text-[11px] text-slate-500 font-semibold">{{ item.bvid }}</div>
                                    </div>
                                    <div class="mt-2 flex flex-wrap gap-1">
                                        <span
                                            v-for="tag in item.tags"
                                            :key="tag"
                                            class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black"
                                        >
                                            {{ tag }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                v-if="item.parts?.length <= 1"
                                @click="$emit('select-result', item)"
                                class="w-full px-3 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition"
                            >
                                一键点歌
                            </button>

                            <div v-else class="space-y-2">
                                <button
                                    @click="$emit('toggle-parts', item.bvid)"
                                    class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:border-indigo-300 hover:text-indigo-600 transition"
                                >
                                    {{ expandedBvid === item.bvid ? '收起分P' : `选择分P (${item.parts.length})` }}
                                </button>
                                <div v-if="expandedBvid === item.bvid" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        v-for="part in item.parts"
                                        :key="`${item.bvid}-${part.page}`"
                                        @click="$emit('select-part', { item, part })"
                                        class="text-left px-3 py-3 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition"
                                    >
                                        <div class="text-xs font-black text-indigo-500">P{{ part.page }}</div>
                                        <div class="text-sm text-slate-700 font-semibold truncate">{{ part.part }}</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else-if="searchKeyword && !searchLoading" class="text-sm text-slate-400 px-2 py-8 text-center">
                        暂无搜索结果
                    </div>
                    <div v-else class="text-sm text-slate-300 px-2 py-8 text-center">
                        输入关键词开始搜索
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
const props = defineProps({
    modelValue: Boolean,
    searchKeyword: String,
    searchLoading: Boolean,
    searchResults: {
        type: Array,
        default: () => []
    },
    expandedBvid: String,
});

const emit = defineEmits([
    'update:modelValue',
    'update:searchKeyword',
    'search',
    'toggle-parts',
    'select-result',
    'select-part',
    'preview',
]);

const handleClose = () => {
    emit('update:modelValue', false);
};
</script>
