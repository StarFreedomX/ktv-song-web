<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="handleClose">
            <div class="modal-container bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
                <div class="flex items-center justify-between px-2">
                    <h3 class="text-xl font-black text-slate-800">
                        {{ isAddingToFavorites ? '添加收藏' : '添加新歌曲' }}
                    </h3>
                    <button @click="handleClearAll"
                            class="clear-btn group">
                        <span class="text-xs font-bold">清空输入</span>
                    </button>
                </div>

                <div class="space-y-1">
                    <label class="modal-label">
                        Bilibili KTV 搜索
                    </label>
                    <div class="flex gap-2">
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
                            class="modal-search-btn shrink-0 px-4 py-3 rounded-2xl text-white text-sm font-bold transition disabled:opacity-50"
                            :disabled="searchLoading"
                        >
                            {{ searchLoading ? '搜索中' : '搜索' }}
                        </button>
                    </div>
                    <div v-if="searchResults.length" class="max-h-72 overflow-y-auto pr-1 space-y-2">
                        <div
                            v-for="item in searchResults"
                            :key="item.bvid"
                            class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2"
                        >
                            <div class="flex gap-3">
                                <img :src="item.pic" :alt="item.title" class="w-20 h-12 rounded-xl object-cover bg-slate-200 shrink-0">
                                <div class="min-w-0 flex-1">
                                    <div class="text-sm font-bold text-slate-800 line-clamp-2">{{ item.title }}</div>
                                    <div v-if="item.author" class="mt-0.5 text-[11px] text-slate-600 font-semibold truncate">
                                        UP主：{{ item.author }}
                                    </div>
                                    <div class="mt-1 text-[11px] text-slate-500 font-semibold">{{ item.bvid }}</div>
                                    <div class="mt-1 flex flex-wrap gap-1">
                                        <span
                                            v-for="tag in item.tags"
                                            :key="tag"
                                            class="modal-tag px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                        >
                                            {{ tag }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                v-if="item.parts?.length <= 1"
                                @click="$emit('select-result', item)"
                                class="modal-primary-btn w-full px-3 py-2 rounded-xl text-white text-sm font-bold transition"
                            >
                                一键点歌
                            </button>

                            <div v-else class="space-y-2">
                                <button
                                    @click="$emit('toggle-parts', item.bvid)"
                                    class="modal-secondary-btn w-full px-3 py-2 rounded-xl bg-white border text-slate-700 text-sm font-bold transition"
                                >
                                    {{ expandedBvid === item.bvid ? '收起分P' : `选择分P (${item.parts.length})` }}
                                </button>
                                <div v-if="expandedBvid === item.bvid" class="space-y-1">
                                    <button
                                        v-for="part in item.parts"
                                        :key="`${item.bvid}-${part.page}`"
                                        @click="$emit('select-part', { item, part })"
                                        class="modal-part-btn w-full text-left px-3 py-2 rounded-xl bg-white border transition"
                                    >
                                        <div class="modal-part-index text-xs font-black">P{{ part.page }}</div>
                                        <div class="text-sm text-slate-700 font-semibold truncate">{{ part.part }}</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="searchKeyword && !searchLoading" class="text-xs text-slate-400 px-1">
                        暂无搜索结果
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="modal-label">
                        智能提取 (粘贴B站分享文案)
                    </label>
                    <textarea :value="autoInput" @input="onAutoInput"
                              class="modal-textarea"
                              placeholder="在这里粘贴..."></textarea>
                </div>

                <div class="relative flex items-center justify-center py-2">
                    <div class="w-full border-t border-slate-100"></div>
                    <span class="absolute bg-white px-3 text-[10px] font-bold text-slate-300">手动输入</span>
                </div>

                <div class="space-y-3">
                    <input :value="form.title" @input="$emit('update:form', { ...form, title: $event.target.value })"
                           class="modal-input"
                           placeholder="歌曲标题">
                    <input :value="form.url" @input="$emit('update:form', { ...form, url: $event.target.value })"
                           class="modal-input"
                           placeholder="跳转链接">
                </div>

                <div class="flex gap-3 pt-2">
                    <ComfirmButton
                        type="secondary"
                        class="flex-1"
                        @click="handleClose"
                    >
                        取消
                    </ComfirmButton>

                    <ComfirmButton
                        type="primary"
                        class="flex-1"
                        @click="$emit('submit')"
                    >
                        {{ isAddingToFavorites ? '确认收藏' : '确认添加' }}
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Boolean,          // 控制显隐
    isAddingToFavorites: Boolean, // 模式切换
    searchKeyword: String,
    searchLoading: Boolean,
    searchResults: {
        type: Array,
        default: () => []
    },
    expandedBvid: String,
    autoInput: String,            // 自动输入的内容
    form: Object                  // 表单对象 {title, url}
});

const emit = defineEmits([
    'update:modelValue',
    'update:isAddingToFavorites',
    'update:searchKeyword',
    'update:autoInput',
    'update:form',
    'search',
    'toggle-parts',
    'select-result',
    'select-part',
    'auto-recognize',
    'submit'
]);

const handleClose = () => {
    emit('update:modelValue', false);
    emit('update:isAddingToFavorites', false);
};

const handleClearAll = () => {
    emit('update:autoInput', '');
    emit('update:form', { title: '', url: '' });
};

const onAutoInput = (e) => {
    const value = e.target.value;
    emit('update:autoInput', value);
    emit('auto-recognize', value);
};
</script>

<style scoped>
@reference "tailwindcss";

/* 继承自 App.vue 的全局变量 */
.modal-label {
    @apply text-[10px] font-bold ml-1 uppercase tracking-widest;
    color: var(--brand-color);
}

.clear-btn {
    @apply flex items-center gap-1.5 px-3 border py-1.5 text-slate-400 rounded-full transition-all;
}

.clear-btn:hover {
    color: var(--brand-color);
    background-color: var(--brand-color-bg);
    border-color: var(--brand-color-light);
}

.modal-textarea {
    @apply w-full px-4 py-3 rounded-2xl outline-none border-2 border-transparent transition text-sm h-24 resize-none;
    background-color: var(--brand-color-bg);
}

.modal-textarea:focus {
    border-color: var(--brand-color-light);
}

.modal-input {
    @apply w-full px-4 py-3 bg-slate-50 rounded-xl outline-none transition text-sm;
}

.modal-input:focus {
    @apply ring-2;
    ring-color: var(--brand-color-light);
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
