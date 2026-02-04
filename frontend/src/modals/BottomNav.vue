<template>
    <div class="fixed bottom-0 left-0 right-0 z-40 px-4 pb-2 pt-2 bg-white/80 backdrop-blur-md border-t border-slate-100 flex items-center justify-between max-w-md mx-auto">
        <button @click="$emit('refresh')" class="p-3 text-slate-400 hover:text-indigo-600 transition active:scale-90">
            <svg :class="{ 'animate-spin-once': isRefreshing }"
                 width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.25L21 8"></path>
                <polyline points="21 3 21 8 16 8"></polyline>
            </svg>
        </button>

        <button @click="$emit('prev')"
                :disabled="historyEmpty && singingEmpty"
                class="p-3 text-slate-400 hover:text-indigo-600 transition active:scale-90 disabled:opacity-20">
            <svg class="transform scale-x-[-1]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <div class="flex flex-col items-center">
            <button @click="$emit('add')"
                    class="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-200 flex items-center justify-center -translate-y-5 border-4 border-white active:scale-95 transition-transform">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </button>
        </div>

        <button @click="$emit('next')"
                :disabled="queueEmpty && singingEmpty"
                class="p-3 text-slate-400 hover:text-indigo-600 transition active:scale-90 disabled:opacity-20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
        </button>

        <button @click="$emit('shuffle')" class="p-3 text-slate-400 hover:text-orange-500 transition active:scale-90">
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
