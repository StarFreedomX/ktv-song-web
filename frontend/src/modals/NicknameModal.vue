<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-mask"
             @click.self="handleClose">
            <div class="modal-container">
                <div class="modal-icon-badge">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>

                <div class="space-y-2">
                    <h3 class="modal-title">设置你的昵称</h3>
                    <p class="modal-subtitle">让大家知道是谁点的歌吧！</p>
                </div>

                <input :value="tempNickname"
                       @input="$emit('update:tempNickname', $event.target.value)"
                       @keyup.enter="handleSave"
                       class="nickname-input"
                       placeholder="输入昵称..."
                       autoFocus>

                <ComfirmButton
                    type="primary"
                    :disabled="!tempNickname?.trim()"
                    class="w-full"
                    @click="handleSave"
                >
                    开始点歌
                </ComfirmButton>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Boolean, // showNicknameModal
    tempNickname: String,
    hasNickname: Boolean // 外部传入的 nickname 是否存在的判断结果
});

const emit = defineEmits(['update:modelValue', 'update:tempNickname', 'save']);

const handleClose = () => {
    // 只有当已经有昵称时，点击背景才允许关闭
    if (props.hasNickname) {
        emit('update:modelValue', false);
    }
};

const handleSave = () => {
    if (props.tempNickname?.trim()) {
        emit('save');
    }
};
</script>

<style scoped>
@reference "tailwindcss";

/* === 弹窗遮罩：使用更重的模糊感 === */
.modal-mask {
    @apply fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md;
    background-color: rgba(15, 23, 42, 0.6); /* 对应 slate-900/60 */
}

/* === 容器 === */
.modal-container {
    @apply w-full max-w-sm rounded-xl shadow-2xl p-8 space-y-6 text-center border;
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

/* === 顶部 Badge === */
.modal-icon-badge {
    @apply w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-transform;
    background-color: var(--brand-color-light);
    color: var(--brand-color);
}

.modal-container:hover .modal-icon-badge {
    @apply scale-110;
}

.modal-title {
    @apply text-2xl font-black;
    color: var(--text-main);
}

.modal-subtitle {
    @apply text-sm;
    color: var(--text-sub);
}

/* === 输入框 === */
.nickname-input {
    @apply w-full px-6 py-4 rounded-2xl outline-none text-center text-lg font-bold transition-all border-2 border-transparent;
    background-color: #f8fafc;
    color: var(--text-main);
}

.nickname-input:focus {
    background-color: white;
    border-color: var(--brand-color-light);
    box-shadow: 0 0 0 4px rgba(var(--brand-color-rgb), 0.1);
}


.primary-shadow-lg {
    box-shadow: 0 10px 25px -5px rgba(var(--brand-color-rgb), 0.3);
}

.primary-shadow-lg:disabled {
    box-shadow: none;
}

/* 过渡动画 */
.modal-fade-enter-active, .modal-fade-leave-active {
    transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-fade-enter-from, .modal-fade-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
}
</style>
