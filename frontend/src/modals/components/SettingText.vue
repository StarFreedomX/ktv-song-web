<template>
    <div class="setting-text-container">
        <div class="setting-text-header">
            <span class="setting-text-title">{{ title }}</span>

            <button v-if="actionText && !isEditing"
                    @click="startEdit"
                    class="setting-text-action">
                {{ actionText }}
            </button>
        </div>

        <div class="setting-text-body">
            <div v-if="!isEditing" class="setting-text-display">
                <slot>{{ modelValue || '未设置' }}</slot>
            </div>

            <input
                v-else
                ref="inputRef"
                v-model="editValue"
                type="text"
                class="setting-text-input"
                @blur="handleBlur"
                @keyup.enter="$event.target.blur()"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps(['title', 'modelValue', 'actionText']);
const emit = defineEmits(['update:modelValue']);

const isEditing = ref(false);
const editValue = ref('');
const inputRef = ref(null);

const startEdit = () => {
    editValue.value = props.modelValue;
    isEditing.value = true;
    nextTick(() => {
        inputRef.value?.focus();
    });
};

const handleBlur = () => {
    isEditing.value = false;
    if (editValue.value !== props.modelValue) {
        emit('update:modelValue', editValue.value);
    }
};
</script>

<style scoped>
@reference "tailwindcss";

.setting-text-container {
    /* === 1. 颜色变量 (对接 App.vue) === */
    --st-bg: var(--brand-color-bg);       /* 容器背景色 */
    --st-border: var(--border-base);      /* 容器边框色 */
    --st-title-color: var(--text-main);   /* 标题文字颜色 */
    --st-action-color: var(--brand-color); /* 操作按钮颜色 */
    --st-value-color: var(--text-main);    /* 展示值文字颜色 */

    /* === 2. 输入框变量 === */
    --st-input-bg: white;
    --st-input-border: var(--border-base);
    --st-input-focus: var(--brand-color);
    --st-input-text: var(--text-main);

    @apply p-4 rounded-2xl border transition-all;
    background-color: var(--st-bg);
    border-color: var(--st-border);
}

.setting-text-header {
    @apply flex items-center justify-between mb-2;
}

.setting-text-title {
    @apply font-bold;
    color: var(--st-title-color);
}

.setting-text-action {
    @apply text-xs font-bold hover:underline;
    color: var(--st-action-color);
}

.setting-text-body {
    @apply text-sm font-medium text-left;
}

.setting-text-display {
    @apply py-1;
    color: var(--st-value-color);
}

.setting-text-input {
    @apply w-full rounded-xl px-3 py-1 outline-none shadow-sm border transition-all;
    background-color: var(--st-input-bg);
    border-color: var(--st-input-border);
    color: var(--st-input-text);
}

.setting-text-input:focus {
    /* 聚焦时边框色对齐主题色 */
    border-color: var(--st-input-focus);
    box-shadow: 0 0 0 2px rgba(var(--brand-color-rgb), 0.1);
}
</style>
