<template>
    <div class="switch-container">
        <div class="switch-info">
            <div class="switch-title">{{ title }}</div>
            <div v-if="description" class="switch-desc">{{ description }}</div>
        </div>

        <button
            @click="$emit('update:modelValue', !modelValue)"
            class="switch-track"
            :class="{ 'is-active': modelValue }"
        >
            <span
                class="switch-thumb"
                :class="{ 'is-active': modelValue }"
            ></span>
        </button>
    </div>
</template>

<script setup>
defineProps(['modelValue', 'title', 'description']);
defineEmits(['update:modelValue']);
</script>

<style scoped>
@reference "tailwindcss";

.switch-container {
    /* === 1. 布局参数调节 === */
    --switch-track-width: 3rem;           /* 轨道宽度 (w-12) */
    --switch-track-height: 1.5rem;        /* 轨道高度 (h-6) */
    --switch-thumb-size: 1rem;            /* 滑块尺寸 */
    --switch-thumb-offset: 0.25rem;       /* 未开启时的边距 (left-1) */

    /* === 2. 颜色变量 (对接 App.vue) === */
    --switch-bg: var(--brand-color-bg);   /* 容器背景色 */
    --switch-border: var(--border-base);  /* 容器边框色 */

    --switch-track-off: #cbd5e1;          /* 关闭时的轨道颜色 (slate-300) */
    --switch-track-on: var(--brand-color); /* 开启时的轨道颜色 */
    --switch-thumb-bg: white;             /* 滑块颜色 */

    --switch-title-color: var(--text-main); /* 标题文字颜色 */
    --switch-desc-color: var(--text-sub);   /* 描述文字颜色 */

    @apply flex items-center justify-between p-4 rounded-2xl border transition-all;
    background-color: var(--switch-bg);
    border-color: var(--switch-border);
}

.switch-info {
    @apply flex flex-col;
}

.switch-title {
    @apply font-bold;
    color: var(--switch-title-color);
}

.switch-desc {
    @apply text-[10px];
    color: var(--switch-desc-color);
}

.switch-track {
    @apply relative flex items-center rounded-full transition-colors duration-300;
    width: var(--switch-track-width);
    height: var(--switch-track-height);
    background-color: var(--switch-track-off);
}

.switch-track.is-active {
    background-color: var(--switch-track-on);
}

.switch-thumb {
    @apply absolute rounded-full shadow transition-all duration-300;
    width: var(--switch-thumb-size);
    height: var(--switch-thumb-size);
    background-color: var(--switch-thumb-bg);
    /* 计算滑块位置：起始偏移 */
    left: var(--switch-thumb-offset);
}

.switch-thumb.is-active {
    /* 计算开启后的位置：轨道宽度 - 滑块宽度 - 偏移量 */
    left: calc(var(--switch-track-width) - var(--switch-thumb-size) - var(--switch-thumb-offset));
}
</style>
