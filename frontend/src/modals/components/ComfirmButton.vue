<template>
    <button
        :class="['game-btn', type === 'primary' ? 'btn-primary' : 'btn-secondary']"
    >
        <slot />
    </button>
</template>

<script setup>
defineProps({
    type: {
        type: String,
        default: 'primary' // primary 或 secondary
    }
});
</script>

<style scoped>
@reference "tailwindcss";

.game-btn {
    /* =========================================
       1. 尺寸与位移参数 (Padding & Movement)
       ========================================= */
    --btn-padding-y: 0.5rem;          /* 纵向内边距 */
    --btn-press-move: 2px;            /* 点击时的下沉位移量 */

    /* =========================================
       2. 拟物边缘精细调节 (Thickness & Rim)
       ========================================= */
    /* 顶部边缘 (上窄) */
    --btn-top-rim-offset: 0px;       /* 顶部灰色边线的偏移量 */
    --btn-top-rim-spread: 1px;        /* 顶部灰色边线的粗细 */

    /* 底部厚度 (下宽) */
    --btn-thickness: 2px;             /* 默认厚度(影子高度) */
    --btn-active-thickness: 2px;      /* 按下后的剩余厚度 */
    --btn-bottom-rim-spread: 1px;     /* 底部包裹厚度的灰色边线粗细 */

    /* =========================================
       3. 共享基础颜色 (Global Colors)
       ========================================= */
    --btn-main-border: white;         /* 按钮本体的 3px 实线边框 */
    --btn-outer-shadow: #E2E8F0;      /* 拟物最外圈的灰色线条色 */

    /* =========================================
       4. 主按钮配色 (Primary)
       ========================================= */
    --primary-bg: var(--brand-color, #FF3377);
    --primary-text: white;
    --primary-shadow-dark: var(--brand-color-dark, #D6285A);

    /* =========================================
       5. 次要按钮配色 (Secondary)
       ========================================= */
    --secondary-bg: #f1f5f9;
    --secondary-text: #64748b;
    --secondary-shadow-dark: #CBD5E1;

    /* --- 基础样式应用 --- */
    @apply relative font-black transition-all active:scale-95;
    padding-top: var(--btn-padding-y);
    padding-bottom: var(--btn-padding-y);
    border: 3px solid var(--btn-main-border);
    cursor: pointer;
}

/* --- 主按钮样式应用 --- */
.btn-primary {
    background-color: var(--primary-bg);
    color: var(--primary-text);
    @apply rounded-xl;

    /* 阴影逻辑：顶部边线 + 底部边线 + 底部厚度填充 */
    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 0 var(--primary-shadow-dark);
}

.btn-primary:active {
    transform: translateY(var(--btn-press-move));
    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 0 var(--primary-shadow-dark);
}

/* --- 次要按钮样式应用 --- */
.btn-secondary {
    background-color: var(--secondary-bg);
    color: var(--secondary-text);
    @apply rounded-xl;

    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 0 var(--secondary-shadow-dark);
}

.btn-secondary:active {
    transform: translateY(var(--btn-press-move));
    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 0 var(--secondary-shadow-dark);
}
</style>
