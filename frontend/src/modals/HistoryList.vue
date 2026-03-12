<template>
    <div v-show="active" class="history-list-container">
        <div v-for="element in processedHistory" :key="element.id"
             class="song-card group">

            <div class="song-info" @click="$emit('go-to', element)">
                <div class="song-title">
                    {{ element.title }}
                </div>
                <div class="song-meta">
                    <span v-if="element.addedBy" class="user-tag">
                        {{ element.addedBy }}
                    </span>
                    <div class="song-url">{{ element.url }}</div>
                </div>
            </div>

            <div class="song-actions">
                <button @click.stop="$emit('toggle-favorite', element)"
                        :class="['action-btn', isFavorited(element) ? 'is-fav' : 'is-not-fav']"
                        title="收藏">
                    <svg width="15" height="15" viewBox="0 0 24 24" :fill="isFavorited(element) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                    </svg>
                </button>

                <button @click.stop="$emit('undo', element)"
                        class="action-btn undo-btn"
                        title="撤回到待唱顶部">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6-6M3 10l6 6"/>
                    </svg>
                </button>

                <button @click="$emit('re-add', element)"
                        class="re-add-btn">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span class="text-[10px] font-bold">再唱</span>
                </button>
            </div>
        </div>

        <div v-if="historyList.length <= 1" class="empty-state">
            暂无更多历史记录
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    active: Boolean,
    historyList: Array,
    isFavorited: Function
});

const emit = defineEmits(['go-to', 'toggle-favorite', 'undo', 're-add']);

const processedHistory = computed(() => {
    return props.historyList.slice().reverse();
});
</script>

<style scoped>
@reference "tailwindcss";

.history-list-container {
    /* === 变量映射 (对接 App.vue) === */
    --card-bg: rgba(254, 254, 252, 0.5); /* 对应 bg-slate-50/50，改用主题背景 */
    --card-border: var(--border-base);
    --card-title-color: var(--text-sub);
    --card-title-hover: var(--brand-color);

    --tag-bg: #f1f5f9;
    --tag-text: #94a3b8;

    --btn-brand-bg: var(--brand-color-light);
    --btn-brand-text: var(--brand-color);
}

.song-card {
    @apply mb-2 px-5 py-3 rounded-2xl border flex items-center transition-all opacity-90;
    background-color: var(--card-bg);
    border-color: var(--card-border);
}

.song-card:hover {
    @apply opacity-100;
    border-color: var(--brand-color-light);
}

.song-info {
    @apply flex-1 min-w-0 cursor-pointer;
}

.song-title {
    @apply text-sm font-bold truncate transition-colors;
    color: var(--card-title-color);
}

.song-card:hover .song-title {
    color: var(--card-title-hover);
}

.song-meta {
    @apply flex items-center gap-2 mt-0.5;
}

.user-tag {
    @apply shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-medium;
    background-color: var(--tag-bg);
    color: var(--tag-text);
}

.song-url {
    @apply text-[10px] truncate;
    color: #cbd5e1; /* 对应 text-slate-300 */
}

.song-actions {
    @apply flex items-center;
}

.action-btn {
    @apply p-2 transition-all;
    color: #cbd5e1;
}

.is-fav {
    @apply text-red-500;
}

.is-not-fav:hover {
    @apply text-red-400;
}

.undo-btn:hover {
    color: var(--brand-color);
}

.re-add-btn {
    @apply flex items-center gap-1 px-2 py-1 rounded-xl transition-all;
    background-color: var(--btn-brand-bg);
    color: var(--btn-brand-text);
}

.re-add-btn:active {
    background-color: var(--brand-color);
    color: white;
}

.empty-state {
    @apply text-center py-20 text-sm;
    color: #cbd5e1;
}
</style>
