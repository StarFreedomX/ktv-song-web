<script setup>
defineProps({
    modelValue: Boolean,
    nickname: String,
    jumpMode: String,
    autoJump: Boolean
});

defineEmits([
    'update:modelValue',
    'update:jumpMode',
    'update:autoJump',
    'edit-nickname'
]);
</script>

<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', false)">
            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6">
                <h3 class="text-xl font-bold text-slate-800">偏好设置</h3>

                <div class="space-y-4">
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-bold text-slate-700">我的昵称</span>
                            <button @click="$emit('edit-nickname')" class="text-xs font-bold text-indigo-600 hover:underline">修改</button>
                        </div>
                        <div class="text-sm text-slate-500 font-medium">{{ nickname || '未设置' }}</div>
                    </div>

                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-bold text-slate-700">跳转方式</span>
                            <div class="relative flex bg-slate-200 p-1 rounded-xl w-32 h-9 overflow-hidden">
                                <div class="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,1.2,0.3,1)]"
                                     :style="{ transform: jumpMode === 'app' ? 'translateX(100%)' : 'translateX(0)' }"></div>

                                <button @click="$emit('update:jumpMode', 'web')"
                                        class="relative z-10 flex-1 text-xs font-bold transition-colors duration-200"
                                        :class="jumpMode === 'web' ? 'text-indigo-600' : 'text-slate-500'">网页
                                </button>
                                <button @click="$emit('update:jumpMode', 'app')"
                                        class="relative z-10 flex-1 text-xs font-bold transition-colors duration-200"
                                        :class="jumpMode === 'app' ? 'text-indigo-600' : 'text-slate-500'">App
                                </button>
                            </div>
                        </div>
                        <p class="text-[10px] text-slate-400">网页模式打开 H5 页面，App 尝试唤起客户端</p>
                    </div>

                    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <div class="font-bold text-slate-700">直接跳转</div>
                            <div class="text-[10px] text-slate-400">点击歌曲后不再弹出确认框</div>
                        </div>
                        <button @click="$emit('update:autoJump', !autoJump)"
                                :class="['w-12 h-6 rounded-full transition-colors duration-300 relative focus:outline-none flex items-center', autoJump ? 'bg-indigo-600 shadow-inner' : 'bg-slate-300']">
                            <span :class="['absolute bg-white w-4 h-4 rounded-full shadow transition-all duration-300 ease-[cubic-bezier(0.34,1.2,0.5,1)]', autoJump ? 'left-7 scale-110' : 'left-1 scale-100']"></span>
                        </button>
                    </div>
                </div>

                <button @click="$emit('update:modelValue', false)"
                        class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition shadow-lg shadow-indigo-100">
                    完成
                </button>
            </div>
        </div>
    </transition>
</template>
