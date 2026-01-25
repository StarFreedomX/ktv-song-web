<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', null)">

            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6">
                <div class="text-center">
                    <div class="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800">即将离开页面</h3>
                    <p class="text-slate-500 mt-2 text-sm">
                        确认要前往播放 <span class="font-semibold text-indigo-600">"{{ songTitle }}"</span> 吗？
                    </p>
                </div>

                <div class="flex space-x-3">
                    <button @click="$emit('update:modelValue', null)"
                            class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
                        留在本页
                    </button>
                    <button @click="$emit('confirm')"
                            class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">
                        立即前往
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
defineProps({
    modelValue: String, // 传入的 pendingJumpUrl
    songTitle: String   // 传入的 jumpSongTitle
});

defineEmits(['update:modelValue', 'confirm']);
</script>
