<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-mask"
             @click.self="$emit('update:modelValue', null)">

            <div class="modal-container">
                <h3 class="modal-title">编辑歌曲信息</h3>

                <div class="modal-form-space">
                    <div class="input-group">
                        <label class="input-label">歌曲名称</label>
                        <input v-model="localForm.title"
                               class="modal-input"
                               placeholder="输入标题...">
                    </div>

                    <div class="input-group">
                        <label class="input-label">跳转链接</label>
                        <input v-model="localForm.url"
                               class="modal-input"
                               placeholder="https://...">
                    </div>
                </div>

                <div class="modal-actions">
                    <ComfirmButton
                        type="secondary"
                        class="modal-btn-ext"
                        @click="$emit('update:modelValue', null)"
                    >
                        取消
                    </ComfirmButton>

                    <ComfirmButton
                        type="primary"
                        class="modal-btn-ext"
                        @click="handleSave"
                    >
                        保存修改
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import { ref, watch } from 'vue';
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Object,
});

const emit = defineEmits(['update:modelValue', 'save']);

const localForm = ref({ title: '', url: '' });

watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        localForm.value = { ...newVal };
    }
}, { immediate: true });

const handleSave = () => {
    emit('save', { ...localForm.value });
};
</script>

<style scoped>
@reference "tailwindcss";

.modal-mask {
    /* 遮罩层：使用深色透明度 */
    @apply fixed inset-0 z-70 flex items-center justify-center p-4 backdrop-blur-sm;
    background-color: rgba(15, 23, 42, 0.4); /* slate-900/40 */
}

.modal-container {
    /* 容器：对接主背景色 */
    @apply w-full max-w-sm rounded-xl shadow-2xl border p-6 space-y-4;
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

.modal-title {
    @apply text-xl font-bold;
    color: var(--text-main);
}

.modal-form-space {
    @apply space-y-3;
}

.input-group {
    @apply flex flex-col;
}

.input-label {
    @apply text-xs font-bold ml-1 uppercase mb-1;
    color: var(--text-sub);
}

.modal-input {
    /* 输入框样式 */
    @apply w-full px-4 py-3 rounded-xl outline-none transition-all border-2 border-transparent;
    background-color: #f8fafc; /* 对齐偏淡的底色 */
    color: var(--text-main);
}

.modal-input:focus {
    /* 聚焦状态：对齐主题色环 */
    background-color: white;
    border-color: var(--brand-color-light);
    box-shadow: 0 0 0 4px rgba(var(--brand-color-rgb), 0.1);
}

.modal-actions {
    @apply flex space-x-3 pt-2;
}

/* 覆盖组件样式的扩展类 */
.modal-btn-ext {
    @apply flex-1;
}


</style>
