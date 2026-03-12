<template>
    <div class="nav-container">
        <button @click="$emit('refresh')" class="nav-btn-icon hover-brand">
            <svg :class="{ 'animate-spin-once': isRefreshing }"
                 width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.25L21 8"></path>
                <polyline points="21 3 21 8 16 8"></polyline>
            </svg>
        </button>

        <button @click="$emit('prev')"
                :disabled="historyEmpty && singingEmpty"
                class="nav-btn-icon hover-brand disabled:opacity-20">
            <svg class="transform scale-x-[-1]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <div class="flex flex-col items-center">
            <button @click="$emit('add')" class="nav-btn-main">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </button>
        </div>

        <button @click="$emit('next')"
                :disabled="queueEmpty && singingEmpty"
                class="nav-btn-icon hover-brand disabled:opacity-20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <button @click="$emit('shuffle')" class="nav-btn-icon hover-orange">
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
defineProps({
    isRefreshing: Boolean,
    historyEmpty: Boolean,
    queueEmpty: Boolean,
    singingEmpty: Boolean
});

defineEmits(['refresh', 'add', 'prev', 'next', 'shuffle']);
</script>
/* BottomNav.vue */
<style scoped>
@reference "tailwindcss";

.nav-container {
    /* 保持 max-w-md 和 mx-auto 确保在 PC 端预览时不会铺满全屏，依然保持手机比例 */
    @apply fixed bottom-0 left-0 right-0 z-40 px-4 pb-2 pt-2 bg-white/80 backdrop-blur-md border-t border-slate-100 flex items-center justify-between max-w-md mx-auto;
}

.nav-btn-icon {
    @apply p-3 text-slate-400 transition active:scale-90 flex items-center justify-center;
}

.hover-brand:hover {
    color: var(--brand-color);
}

.hover-orange:hover {
    @apply text-orange-500;
}

/* BottomNav.vue */
.nav-btn-main {
    @apply w-16 h-16 text-white rounded-full border-4 border-white transition-transform active:scale-95;
    @apply flex items-center justify-center -translate-y-5;

    /* 继承背景色 */
    background-color: var(--brand-color);

    box-shadow: 0 10px 20px -5px rgba(var(--brand-color-rgb), 0.4);

    margin-top: -1.25rem;
}
</style>
