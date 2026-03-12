<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="handleClose">
            <div class="modal-container bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
                <div class="flex items-center justify-between px-2">
                    <h3 class="text-xl font-black text-slate-800">
                        {{ isAddingToFavorites ? '添加收藏' : '添加新歌曲' }}
                    </h3>
                    <button @click="handleClearAll"
                            class="clear-btn group">
                        <span class="text-xs font-bold">清空输入</span>
                    </button>
                </div>

                <div class="space-y-1">
                    <label class="modal-label">
                        智能提取 (粘贴B站分享文案)
                    </label>
                    <textarea :value="autoInput" @input="onAutoInput"
                              class="modal-textarea"
                              placeholder="在这里粘贴..."></textarea>
                </div>

                <div class="relative flex items-center justify-center py-2">
                    <div class="w-full border-t border-slate-100"></div>
                    <span class="absolute bg-white px-3 text-[10px] font-bold text-slate-300">手动输入</span>
                </div>

                <div class="space-y-3">
                    <input :value="form.title" @input="$emit('update:form', { ...form, title: $event.target.value })"
                           class="modal-input"
                           placeholder="歌曲标题">
                    <input :value="form.url" @input="$emit('update:form', { ...form, url: $event.target.value })"
                           class="modal-input"
                           placeholder="跳转链接">
                </div>

                <div class="flex gap-3 pt-2">
                    <ComfirmButton
                        type="secondary"
                        class="flex-1"
                        @click="handleClose"
                    >
                        取消
                    </ComfirmButton>

                    <ComfirmButton
                        type="primary"
                        class="flex-1"
                        @click="$emit('submit')"
                    >
                        {{ isAddingToFavorites ? '确认收藏' : '确认添加' }}
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import ComfirmButton from './components/ComfirmButton.vue';

const props = defineProps({
    modelValue: Boolean,          // 控制显隐
    isAddingToFavorites: Boolean, // 模式切换
    autoInput: String,            // 自动输入的内容
    form: Object                  // 表单对象 {title, url}
});

const emit = defineEmits([
    'update:modelValue',
    'update:isAddingToFavorites',
    'update:autoInput',
    'update:form',
    'auto-recognize',
    'submit'
]);

const handleClose = () => {
    emit('update:modelValue', false);
    emit('update:isAddingToFavorites', false);
};

const handleClearAll = () => {
    emit('update:autoInput', '');
    emit('update:form', { title: '', url: '' });
};

const onAutoInput = (e) => {
    const value = e.target.value;
    emit('update:autoInput', value);
    emit('auto-recognize', value);
};
</script>

<style scoped>
@reference "tailwindcss";

/* 继承自 App.vue 的全局变量 */
.modal-label {
    @apply text-[10px] font-bold ml-1 uppercase tracking-widest;
    color: var(--brand-color);
}

.clear-btn {
    @apply flex items-center gap-1.5 px-3 border py-1.5 text-slate-400 rounded-full transition-all;
}

.clear-btn:hover {
    color: var(--brand-color);
    background-color: var(--brand-color-bg);
    border-color: var(--brand-color-light);
}

.modal-textarea {
    @apply w-full px-4 py-3 rounded-2xl outline-none border-2 border-transparent transition text-sm h-24 resize-none;
    background-color: var(--brand-color-bg);
}

.modal-textarea:focus {
    border-color: var(--brand-color-light);
}

.modal-input {
    @apply w-full px-4 py-3 bg-slate-50 rounded-xl outline-none transition text-sm;
}

.modal-input:focus {
    @apply ring-2;
    ring-color: var(--brand-color-light);
}

</style>
