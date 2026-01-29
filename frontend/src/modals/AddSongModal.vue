<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="handleClose">
            <div class="modal-container bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 space-y-4">
                <h3 class="text-xl font-black text-slate-800 px-2">
                    {{ isAddingToFavorites ? '添加收藏' : '添加新歌曲' }}
                </h3>

                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-indigo-400 ml-1 uppercase tracking-widest">
                        智能提取 (粘贴B站分享文案)
                    </label>
                    <textarea :value="autoInput" @input="onAutoInput"
                              class="w-full px-4 py-3 bg-indigo-50/50 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-200 transition text-sm h-24 resize-none"
                              placeholder="在这里粘贴..."></textarea>
                </div>

                <div class="relative flex items-center justify-center py-2">
                    <div class="w-full border-t border-slate-100"></div>
                    <span class="absolute bg-white px-3 text-[10px] font-bold text-slate-300">手动输入</span>
                </div>

                <div class="space-y-3">
                    <input :value="form.title" @input="$emit('update:form', { ...form, title: $event.target.value })"
                           class="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                           placeholder="歌曲标题">
                    <input :value="form.url" @input="$emit('update:form', { ...form, url: $event.target.value })"
                           class="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                           placeholder="跳转链接">
                </div>

                <div class="flex gap-3 pt-2">
                    <ComfirmButton
                        type="secondary"
                        class="flex-1 !py-3 !rounded-xl"
                        @click="handleClose"
                    >
                        取消
                    </ComfirmButton>

                    <ComfirmButton
                        type="primary"
                        class="flex-1 !py-3 !rounded-xl !shadow-indigo-200"
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
    modelValue: Boolean,          // 控制显隐 (showAddModal)
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

const onAutoInput = (e) => {
    const value = e.target.value;
    emit('update:autoInput', value);
    emit('auto-recognize', value); // 触发父组件的解析逻辑
};
</script>
