<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-mask"
             @click.self="$emit('update:modelValue', null)">

            <div class="modal-container text-center">
                <div class="modal-icon-wrapper">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </div>

                <h3 class="modal-title">即将离开页面</h3>
                <p class="modal-desc">
                    确认要前往播放 <span class="highlight-text">"{{ songTitle }}"</span> 吗？
                </p>

                <div class="modal-actions">
                    <ComfirmButton
                        type="secondary"
                        class="flex-1"
                        @click="$emit('update:modelValue', null)"
                    >
                        留在本页
                    </ComfirmButton>
                    <ComfirmButton
                        type="primary"
                        class="flex-1"
                        @click="$emit('confirm')"
                    >
                        立即前往
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

defineProps({
    modelValue: String,
    songTitle: String
});

defineEmits(['update:modelValue', 'confirm']);
</script>

<style scoped>
@reference "tailwindcss";

.modal-mask {
    @apply fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm;
    background-color: rgba(15, 23, 42, 0.4);
}

.modal-container {
    @apply w-full max-w-sm rounded-3xl shadow-2xl border p-6 space-y-6;
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

.modal-icon-wrapper {
    @apply w-16 h-16 rounded-full flex items-center justify-center mx-auto;
    background-color: var(--brand-color-light);
    color: var(--brand-color);
}

.modal-title {
    @apply text-xl font-bold;
    color: var(--text-main);
}

.modal-desc {
    @apply mt-2 text-sm;
    color: var(--text-sub);
}

.highlight-text {
    @apply font-semibold;
    color: var(--brand-color);
}

.modal-actions {
    @apply flex space-x-3;
}

.modal-fade-enter-active, .modal-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-fade-enter-from, .modal-fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
}
</style>
