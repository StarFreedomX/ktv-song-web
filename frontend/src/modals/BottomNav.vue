<template>
    <nav class="nav-container" aria-label="页面导航">
        <button type="button" class="nav-btn" :class="{ active: modelValue === 'library' }"
                :aria-current="modelValue === 'library' ? 'page' : undefined" @click="$emit('update:modelValue', 'library')">
            <LibraryBigIcon width="22" height="22" aria-hidden="true" />
            <span>歌曲库</span>
        </button>
        <button type="button" class="nav-btn" :class="{ active: modelValue === 'control' }"
                :aria-current="modelValue === 'control' ? 'page' : undefined" @click="$emit('update:modelValue', 'control')">
            <!-- Lucide list-music (ISC); license: public/third-party/Lucide-LICENSE.txt -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16 5H3"></path>
                <path d="M11 12H3"></path>
                <path d="M11 19H3"></path>
                <path d="M21 16V5"></path>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
            <span>歌单控制</span>
        </button>
        <button type="button" class="nav-btn" :class="{ active: modelValue === 'remote' }"
                :aria-current="modelValue === 'remote' ? 'page' : undefined" @click="$emit('update:modelValue', 'remote')">
            <RemoteControlIcon width="22" height="22" aria-hidden="true" />
            <span>投屏遥控</span>
        </button>
    </nav>
</template>

<script setup>
import LibraryBigIcon from '../components/icons/LibraryBigIcon.vue';
import RemoteControlIcon from '../components/icons/RemoteControlIcon.vue';

defineProps({ modelValue: { type: String, default: 'control' } });
defineEmits(['update:modelValue']);
</script>

<style scoped>
@reference "tailwindcss";

.nav-container {
    @apply fixed bottom-0 left-0 right-0 z-40 px-4 pt-2 bg-white/80 backdrop-blur-md border-t border-slate-100 flex items-center justify-between gap-2 max-w-md mx-auto;
    height: calc(65px + env(safe-area-inset-bottom, 0px));
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
}

.nav-btn {
    @apply relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-slate-400 text-[11px] font-bold transition active:scale-95;
}

.nav-btn.active {
    color: var(--brand-color);
    background-color: var(--brand-color-lighter);
}

.nav-btn:hover,
.nav-btn:focus-visible {
    z-index: 1;
    color: var(--brand-color);
}

.nav-btn:focus-visible {
    outline: 2px solid var(--brand-color);
    outline-offset: 2px;
}
</style>
