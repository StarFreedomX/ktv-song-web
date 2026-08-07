<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-mask"
             @click.self="$emit('update:modelValue', false)">

            <div class="modal-container">
                <div class="text-center space-y-6">
                    <div class="modal-icon-wrapper">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                        </svg>
                    </div>

                    <div class="space-y-2">
                        <h3 class="modal-title">确认打乱列表？</h3>
                        <p class="modal-desc">所有歌曲的播放顺序将被随机重新排列。</p>
                    </div>
                </div>

                <div class="modal-actions">
                    <ComfirmButton
                        type="secondary"
                        class="flex-1"
                        @click="$emit('update:modelValue', false)"
                    >
                        取消
                    </ComfirmButton>
                    <ComfirmButton
                        type="primary"
                        class="flex-1"
                        @click="handleConfirm"
                    >
                        立即打乱
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Boolean
});

const emit = defineEmits(['update:modelValue', 'confirm']);

const handleConfirm = () => {
    emit('confirm');
    emit('update:modelValue', false);
};
</script>

<style scoped>
@reference "tailwindcss";

.modal-mask {
    @apply fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm;
    background-color: rgba(15, 23, 42, 0.4);
}

.modal-container {
    @apply w-full max-w-sm rounded-3xl shadow-2xl border p-6 space-y-8;
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

/* 警告图标样式 */
.modal-icon-wrapper {
    @apply w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-transform duration-500;
    background-color: #fff7ed; /* 对应 orange-50，可后续提取为 var(--warning-color-light) */
    color: #f97316;           /* 对应 orange-500，可后续提取为 var(--warning-color) */
}

.modal-container:hover .modal-icon-wrapper {
    @apply rotate-12 scale-110;
}

.modal-title {
    @apply text-xl font-bold;
    color: var(--text-main);
}

.modal-desc {
    @apply text-sm px-4;
    color: var(--text-sub);
}

.modal-actions {
    @apply flex space-x-3;
}


</style>
