<template>
    <div class="segment-container">
        <div class="segment-header">
            <span class="segment-title">{{ title }}</span>

            <div class="segment-wrapper">
                <div
                    class="segment-indicator"
                    :style="indicatorStyle"
                ></div>

                <button
                    v-for="(opt, index) in options"
                    :key="opt.value"
                    @click="$emit('update:modelValue', opt.value)"
                    class="segment-btn"
                    :class="{ 'is-active': modelValue === opt.value }"
                >
                    {{ opt.label }}
                </button>
            </div>
        </div>
        <p v-if="description" class="segment-desc">{{ description }}</p>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: [String, Number, Boolean],
    title: String,
    description: String,
    options: {
        type: Array,
        default: () => []
    }
});

defineEmits(['update:modelValue']);

const indicatorStyle = computed(() => {
    const count = props.options.length;
    if (count === 0) return {};
    const activeIndex = props.options.findIndex(opt => opt.value === props.modelValue);
    if(activeIndex === -1) return { opacity: 0 };

    const width = 100 / count;
    const x = activeIndex * 100;

    return {
        // 这里的 8px 对应下方 .segment-wrapper 的 p-1 (左右各 4px)
        width: `calc(${width}% - ${8/count}px)`,
        transform: `translateX(${x}%)`
    };
});
</script>

<style scoped>
@reference "tailwindcss";

.segment-container {
    /* === 局部变量调节 (对接 App.vue) === */
    --seg-bg: var(--brand-color-bg);       /* 整体容器背景 */
    --seg-border: var(--border-base);      /* 容器边框颜色 */
    --seg-track-bg: #e2e8f0;               /* 轨道背景色 (原本的 bg-slate-200) */
    --seg-indicator-bg: white;             /* 滑块背景色 */

    --seg-text-active: var(--brand-color); /* 选中项文字颜色 */
    --seg-text-inactive: var(--text-sub);  /* 未选中项文字颜色 */
    --seg-title-color: var(--text-main);   /* 标题颜色 */

    @apply p-4 rounded-2xl border;
    background-color: var(--seg-bg);
    border-color: var(--seg-border);
}

.segment-header {
    @apply flex items-center justify-between mb-2;
}

.segment-title {
    @apply font-bold;
    color: var(--seg-title-color);
}

.segment-wrapper {
    /* 分段器的轨道 */
    @apply relative flex p-1 rounded-xl min-w-[128px] h-9 overflow-hidden;
    background-color: var(--seg-track-bg);
}

.segment-indicator {
    /* 滑动块本体 */
    @apply absolute top-1 bottom-1 rounded-xl shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,1.2,0.3,1)];
    background-color: var(--seg-indicator-bg);
}

.segment-btn {
    @apply relative z-10 flex-1 text-xs font-bold transition-colors duration-200;
    color: var(--seg-text-inactive);
}

.segment-btn.is-active {
    color: var(--seg-text-active);
}

.segment-desc {
    @apply text-[10px] text-left;
    color: var(--text-sub);
}
</style>
