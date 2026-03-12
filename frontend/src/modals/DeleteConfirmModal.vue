<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-overlay"
             @click.self="$emit('update:modelValue', null)">

            <div class="modal-container">
                <div class="modal-content">
                    <div class="icon-wrapper">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>

                    <h3 class="modal-title">确认删除？</h3>
                    <p class="modal-body">
                        歌曲 <span class="song-name">"{{ modelValue.title }}"</span> 将被移除。
                    </p>
                </div>

                <div class="modal-actions">
                    <ComfirmButton
                        type="secondary"
                        class="action-btn"
                        @click="$emit('update:modelValue', null)"
                    >
                        返回
                    </ComfirmButton>
                    <ComfirmButton
                        type="primary"
                        class="action-btn"
                        @click="$emit('confirm')"
                    >
                        确认移除
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
@reference "tailwindcss";

/* 遮罩层 */
.modal-overlay {
    @apply fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm;
}

/* 弹窗主体 */
.modal-container {
    @apply bg-white w-full max-w-sm rounded-xl shadow-2xl border border-slate-100 p-6 space-y-6;
}

/* 内容布局 */
.modal-content {
    @apply text-center;
}

/* 图标容器：颜色继承全局变量 */
.icon-wrapper {
    @apply w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4;
    background-color: var(--brand-color-bg);
    color: var(--brand-color);
}

.modal-title {
    @apply text-xl font-black text-slate-800;
}

.modal-body {
    @apply text-slate-500 mt-2 text-sm;
}

.song-name {
    @apply font-bold text-slate-700;
}

/* 底部按钮组 */
.modal-actions {
    @apply flex space-x-3;
}

/* 按钮通用样式提取 */
.action-btn {
    @apply flex-1;
}
</style>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

defineProps({
    modelValue: Object
});

defineEmits(['update:modelValue', 'confirm']);
</script>
