<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', null)">

            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6">
                <div class="text-center">
                    <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800">确认删除？</h3>
                    <p class="text-slate-500 mt-2">
                        歌曲 <span class="font-semibold text-slate-700">"{{ modelValue.title }}"</span> 将被移除。
                    </p>
                </div>

                <div class="flex space-x-3">
                    <button @click="$emit('update:modelValue', null)"
                            class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
                        返回
                    </button>
                    <button @click="$emit('confirm')"
                            class="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition">
                        确认移除
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
defineProps({
    modelValue: Object // 接收整个 deletingSong 对象
});

defineEmits(['update:modelValue', 'confirm']);
</script>
