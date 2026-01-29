<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
             @click.self="handleClose">
            <div class="modal-container bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 text-center">
                <div class="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>

                <div class="space-y-2">
                    <h3 class="text-2xl font-black text-slate-800">设置你的昵称</h3>
                    <p class="text-slate-400 text-sm">让大家知道是谁点的歌吧！</p>
                </div>

                <input :value="tempNickname"
                       @input="$emit('update:tempNickname', $event.target.value)"
                       @keyup.enter="handleSave"
                       class="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-400 text-center text-lg font-bold transition"
                       placeholder="输入昵称..."
                       autoFocus>

                <ComfirmButton
                    type="primary"
                    :disabled="!tempNickname?.trim()"
                    class="w-full !shadow-indigo-200"
                    @click="handleSave"
                >
                    开始点歌
                </ComfirmButton>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Boolean, // showNicknameModal
    tempNickname: String,
    hasNickname: Boolean // 外部传入的 nickname 是否存在的判断结果
});

const emit = defineEmits(['update:modelValue', 'update:tempNickname', 'save']);

const handleClose = () => {
    // 只有当已经有昵称时，点击背景才允许关闭
    if (props.hasNickname) {
        emit('update:modelValue', false);
    }
};

const handleSave = () => {
    if (props.tempNickname?.trim()) {
        emit('save');
    }
};
</script>
