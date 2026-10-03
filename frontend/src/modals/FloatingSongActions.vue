<template>
    <div class="actions-island" role="group" aria-label="歌单操作">
        <button type="button" @click="$emit('refresh')" class="action-btn hover-brand" aria-label="刷新" title="刷新">
            <RefreshIcon :class="{ 'animate-spin-once': isRefreshing }" />
        </button>

        <button type="button" @click="$emit('prev')"
                :disabled="historyEmpty && singingEmpty"
                class="action-btn hover-brand disabled:opacity-20 disabled:cursor-not-allowed" aria-label="上一首" title="上一首">
            <svg class="scale-x-[-1]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <div class="add-button-slot">
            <ComfirmButton type="primary" @click="$emit('add')" class="action-btn-main" aria-label="添加歌曲" title="添加歌曲">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </ComfirmButton>
        </div>

        <button type="button" @click="$emit('next')"
                :disabled="queueEmpty && singingEmpty"
                class="action-btn hover-brand disabled:opacity-20 disabled:cursor-not-allowed" aria-label="下一首" title="下一首">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <button type="button" @click="$emit('shuffle')" class="action-btn hover-orange" aria-label="随机排序" title="随机排序">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
        </button>
    </div>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';
import RefreshIcon from '../components/icons/RefreshIcon.vue';

defineProps({
    isRefreshing: Boolean,
    historyEmpty: Boolean,
    queueEmpty: Boolean,
    singingEmpty: Boolean
});
defineEmits(['refresh', 'add', 'prev', 'next', 'shuffle']);
</script>

<style scoped>
@reference "tailwindcss";

.actions-island {
    @apply fixed left-1/2 -translate-x-1/2 z-40 h-14 flex items-center gap-2 rounded-full border border-white/90 bg-white/90 px-2 backdrop-blur-md;
    bottom: calc(81px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 8px 28px -8px rgba(15, 23, 42, 0.2);
}

.action-btn {
    @apply w-12 h-12 shrink-0 text-slate-400 rounded-full transition active:scale-90 flex items-center justify-center;
}

.hover-brand:hover:not(:disabled) {
    color: var(--brand-color);
}

.hover-orange:hover {
    @apply text-orange-500;
}

.add-button-slot {
    @apply w-16 h-16 shrink-0 -translate-y-5;
}

.add-button-slot > .action-btn-main {
    @apply w-full h-full flex items-center justify-center;
    border-radius: 50%;
    padding: 0;
}

button:focus-visible {
    outline: 2px solid var(--brand-color);
    outline-offset: 3px;
}
</style>
