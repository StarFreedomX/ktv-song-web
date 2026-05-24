<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur"
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
                            class="modal-close-btn flex items-center gap-1.5 px-3 border py-1.5 text-slate-400 rounded-full transition-all group">
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
                        class="modal-search-input flex-1 px-4 py-3 rounded-2xl outline-none border-2 border-transparent transition text-sm"
                        placeholder="输入歌名或歌曲关键词"
                    >
                    <button
                        @click="$emit('search')"
                        class="modal-search-btn shrink-0 px-5 py-3 rounded-2xl text-white text-sm font-bold transition disabled:opacity-50"
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
                                <img
                                    :src="item.pic"
                                    :alt="item.title"
                                    referrerpolicy="no-referrer"
                                    loading="lazy"
                                    decoding="async"
                                    class="w-28 h-16 rounded-2xl object-cover bg-slate-200 shrink-0"
                                    @error="onImgError($event, item)"
                                >
                                <div class="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        class="modal-title-btn text-left text-base font-black text-slate-800 line-clamp-2 transition"
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
                                            class="modal-tag px-2 py-1 rounded-full text-[10px] font-black"
                                        >
                                            {{ tag }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                v-if="item.parts && item.parts.length <= 1"
                                @click="$emit('select-result', item)"
                                class="modal-primary-btn w-full px-3 py-3 rounded-2xl text-white text-sm font-black transition"
                            >
                                一键点歌
                            </button>

                            <div v-else-if="item.parts && item.parts.length > 1" class="space-y-2">
                                <button
                                    @click="$emit('toggle-parts', item.bvid)"
                                    class="modal-secondary-btn w-full px-3 py-3 rounded-2xl bg-white border text-slate-700 text-sm font-black transition"
                                >
                                    {{ expandedBvid === item.bvid ? '收起分P' : `选择分P (${item.parts.length})` }}
                                </button>
                                <div v-if="expandedBvid === item.bvid" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        v-for="part in item.parts"
                                        :key="`${item.bvid}-${part.page}`"
                                        @click="$emit('select-part', { item, part })"
                                        class="modal-part-btn text-left px-3 py-3 rounded-2xl bg-white border transition"
                                    >
                                        <div class="modal-part-index text-xs font-black">P{{ part.page }}</div>
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
    expandedBvid: [String, null],
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

const onImgError = (event, item) => {
    const img = event?.target;
    if (!img || !item?.picProxy) return;
    if (typeof img.src === 'string' && img.src.includes('/api/bilibiliImage')) return;
    img.src = item.picProxy;
};
</script>

<style scoped>
@reference "tailwindcss";

.modal-close-btn:hover {
    color: var(--brand-color);
    background-color: var(--brand-color-bg);
}

.modal-search-input {
    background-color: var(--brand-color-bg);
}
.modal-search-input:focus {
    border-color: var(--brand-color-light);
}

.modal-search-btn {
    background-color: var(--brand-color);
}
.modal-search-btn:hover {
    background-color: var(--brand-color-dark);
}

.modal-title-btn:hover {
    color: var(--brand-color);
}

.modal-tag {
    background-color: var(--brand-color-light);
    color: var(--brand-color);
}

.modal-primary-btn {
    background-color: var(--brand-color);
}
.modal-primary-btn:hover {
    background-color: var(--brand-color-dark);
}

.modal-secondary-btn {
    border-color: var(--brand-color-light);
}
.modal-secondary-btn:hover {
    border-color: var(--brand-color-light);
    color: var(--brand-color);
    background-color: var(--brand-color-bg);
}

.modal-part-btn {
    border-color: var(--brand-color-light);
}
.modal-part-btn:hover {
    border-color: var(--brand-color-light);
    background-color: var(--brand-color-bg);
}

.modal-part-index {
    color: var(--brand-color);
}
</style>
