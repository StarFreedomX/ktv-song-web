<template>
    <div class="min-h-screen flex items-center justify-center p-4">
        <div
            class="w-full max-w-sm bg-[#FEFEFC]/95 backdrop-blur-sm p-8 rounded-xl border-4 border-slate-100 shadow-2xl animate-pop">

            <header class="text-center mb-8">
                <div class="inline-block relative">
                    <img
                        src="/exclamation.svg"
                        class="absolute -left-9 top-2 w-10 h-10 object-contain"
                        alt=""
                    />

                    <h1 class="text-3xl font-black text-slate-800 mb-1">KTV Queue</h1>
                    <div class="h-1 w-full bg-[var(--brand-color,#FE3C71)] rounded-full"></div>
                </div>
                <p class="mt-4 text-slate-500 font-bold text-sm">输入房间号进入房间</p>
            </header>

            <div class="space-y-4">
                <input
                    v-model.trim="roomInput"
                    type="text"
                    maxlength="10"
                    class="w-full px-6 py-5 bg-[#DDDDDB] rounded-xl text-center text-4xl font-bold tracking-widest text-slate-700 outline-none border-4 border-transparent focus:border-[#FE3C71]/20 transition-all placeholder:text-slate-300"
                    placeholder="88888"
                    autofocus
                    @keyup.enter="joinRoom"
                >

                <button
                    @click="joinRoom"
                    class="game-btn w-full"
                >
                    进入房间
                </button>
            </div>

            <div class="mt-8 flex flex-col items-center gap-4">
                <div class="flex items-center gap-4">
                    <a
                        href="https://github.com/starfreedomx/ktv-song-web"
                        target="_blank"
                        class="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                    >
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span class="text-sm font-bold">GitHub</span>
                    </a>
                </div>
                <p class="text-slate-300 text-[10px] uppercase tracking-widest font-bold">Powered by StarFreedomX</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const roomInput = ref('');

const joinRoom = () => {
    if (roomInput.value) {
        router.push({
            name: 'Room',
            query: { roomId: roomInput.value }
        });
    }
};
</script>

<style scoped>
@reference "tailwindcss";

.game-btn {
    /* =========================================
       1. 尺寸与位移参数 (对齐你的要求)
       ========================================= */
    --btn-padding-y: 0.5rem;           /* 纵向内边距 */
    --btn-press-move: 2px;            /* 点击下沉位移 */

    /* =========================================
       2. 拟物边缘精细调节
       ========================================= */
    --btn-top-rim-offset: 0px;        /* 顶部边线偏移 */
    --btn-top-rim-spread: 1px;        /* 顶部边线粗细 */
    --btn-thickness: 2px;             /* 默认厚度 */
    --btn-active-thickness: 2px;      /* 按下后的剩余厚度 (你设置的2px，即按下不减厚度) */
    --btn-bottom-rim-spread: 1px;     /* 底部边线粗细 */

    /* =========================================
       3. 颜色变量 (对齐 Home 页配色)
       ========================================= */
    --btn-main-border: white;
    --btn-outer-shadow: #E2E8F0;
    --btn-bg: var(--brand-color, #FE3C71);
    --btn-text: white;
    --btn-shadow-dark: #D6285A;

    /* --- 基础样式 --- */
    @apply relative font-black transition-all active:scale-95 rounded-xl text-xl;
    background-color: var(--btn-bg);
    color: var(--btn-text);
    padding-top: var(--btn-padding-y);
    padding-bottom: var(--btn-padding-y);
    border: 3px solid var(--btn-main-border);
    cursor: pointer;

    /* 初始阴影状态 */
    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-thickness) 0 0 var(--btn-shadow-dark);
}

.game-btn:active {
    transform: translateY(var(--btn-press-move));
    box-shadow:
        0 var(--btn-top-rim-offset) 0 var(--btn-top-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 var(--btn-bottom-rim-spread) var(--btn-outer-shadow),
        0 var(--btn-active-thickness) 0 0 var(--btn-shadow-dark);
}

input::placeholder {
    color: #505050;
    opacity: 1;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-pop {
    animation: slideUp 0.5s ease-out;
}
</style>
