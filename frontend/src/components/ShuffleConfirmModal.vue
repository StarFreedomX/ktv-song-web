<script setup>
// 定义属性
const props = defineProps({
    modelValue: Boolean // 控制显示隐藏
});

// 定义事件
const emit = defineEmits(['update:modelValue', 'confirm']);

const handleConfirm = () => {
    emit('confirm'); // 触发确认事件
    emit('update:modelValue', false); // 关闭弹窗
};
</script>

<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', false)">

            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-6">
                <div class="text-center">
                    <div class="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800">确认打乱列表？</h3>
                    <p class="text-slate-500 mt-2">所有歌曲的播放顺序将被随机重新排列。</p>
                </div>

                <div class="flex space-x-3">
                    <button @click="$emit('update:modelValue', false)"
                            class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">
                        取消
                    </button>
                    <button @click="handleConfirm"
                            class="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200">
                        立即打乱
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>


