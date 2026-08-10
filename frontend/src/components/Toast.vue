<template>
    <transition name="toast-fade">
        <div v-if="message" class="toast">
            {{ message }}
        </div>
    </transition>
</template>

<script setup>
defineProps({
    message: { type: String, default: '' }
});
</script>

<style scoped>
@reference "tailwindcss";

.toast {
    @apply fixed top-4 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-xl text-white text-sm font-bold shadow-lg whitespace-nowrap;
    /* 跟随主题可配置的危险色 */
    background-color: var(--danger-color);
}

/* toast 过渡：只动 Y 轴，X 轴居中交给 Tailwind 的 translate 属性，避免横向漂移 */
.toast-fade-enter-active,
.toast-fade-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}
</style>
