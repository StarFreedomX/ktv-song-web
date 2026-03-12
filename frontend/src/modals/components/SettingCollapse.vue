<template>
    <div class="collapse-container">
        <div
            @click="isExpanded = !isExpanded"
            class="collapse-header"
        >
            <div class="flex items-center gap-2">
                <span class="collapse-title">{{ title }}</span>
                <span v-if="tag" class="collapse-tag">
                    {{ tag }}
                </span>
            </div>
            <svg
                class="collapse-icon"
                :class="{ 'is-active': isExpanded }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
        </div>

        <transition
            @before-enter="el => el.style.height = '0'"
            @enter="el => el.style.height = el.scrollHeight + 'px'"
            @after-enter="el => el.style.height = 'auto'"
            @before-leave="el => el.style.height = el.scrollHeight + 'px'"
            @leave="el => el.style.height = '0'"
        >
            <div v-show="isExpanded" class="collapse-content">
                <div class="collapse-inner">
                    <slot />
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref } from 'vue';
defineProps(['title', 'tag']);
const isExpanded = ref(false);
</script>

<style scoped>
@reference "tailwindcss";

.collapse-container {
    /* === 局部样式变量 (对接 App.vue) === */
    --collapse-bg: var(--brand-color-bg);       /* 容器背景色 */
    --collapse-border: var(--border-base);      /* 容器边框色 */
    --header-hover-bg: var(--brand-color-light); /* 悬停/激活时的底色 */
    --title-color: var(--text-main);            /* 标题文字颜色 */

    --tag-bg: var(--brand-color-light);         /* Tag 背景色 */
    --tag-text: var(--brand-color);             /* Tag 文字色 */
    --icon-color: var(--text-sub);              /* 箭头图标颜色 */

    @apply rounded-2xl border overflow-hidden transition-all duration-300;
    background-color: var(--collapse-bg);
    border-color: var(--collapse-border);
}

.collapse-header {
    @apply p-4 flex items-center justify-between cursor-pointer transition-colors select-none;
}

/* 交互反馈：点击或悬停时变色 */
.collapse-header:active {
    background-color: var(--header-hover-bg);
    opacity: 0.8;
}

.collapse-title {
    @apply font-bold;
    color: var(--title-color);
}

.collapse-tag {
    @apply px-1.5 py-0.5 text-[10px] rounded-md font-bold uppercase tracking-wider;
    background-color: var(--tag-bg);
    color: var(--tag-text);
}

.collapse-icon {
    @apply w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)];
    color: var(--icon-color);
}

.collapse-icon.is-active {
    @apply rotate-180;
    color: var(--brand-color); /* 展开时箭头变色 */
}

/* 内容区域过渡 */
.collapse-content {
    @apply overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.3,0,0,1)];
}

.collapse-inner {
    @apply px-4 pb-4 space-y-3;
}
</style>
