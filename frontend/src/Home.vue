<template>
    <div class="bg-slate-50 min-h-screen flex items-center justify-center p-6 text-slate-900 font-sans">
        <div class="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-pop">
            <header class="text-center mb-8">
                <h1 class="text-4xl font-black text-indigo-600 mb-2">KTV Queue</h1>
                <p class="text-slate-400 font-medium">输入房间号进入房间</p>
            </header>

            <div class="space-y-4">
                <input
                    v-model.trim="roomInput"
                    type="text"
                    maxlength="10"
                    class="w-full px-6 py-4 bg-slate-50 rounded-2xl text-center text-2xl font-bold tracking-widest outline-none focus:ring-4 focus:ring-indigo-100 transition-all border-2 border-transparent focus:border-indigo-400"
                    placeholder="0000"
                    autofocus
                    @keyup.enter="joinRoom"
                >

                <button
                    @click="joinRoom"
                    class="w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
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
@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-pop {
    animation: slideUp 0.5s ease-out;
}
</style>
