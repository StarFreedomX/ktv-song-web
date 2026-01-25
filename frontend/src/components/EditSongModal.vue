<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', null)">
            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
                <h3 class="text-xl font-bold text-slate-800">编辑歌曲信息</h3>

                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-bold text-slate-400 ml-1 uppercase">歌曲名称</label>
                        <input v-model="localForm.title"
                               class="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 transition"
                               placeholder="输入标题...">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 ml-1 uppercase">跳转链接</label>
                        <input v-model="localForm.url"
                               class="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 transition"
                               placeholder="https://...">
                    </div>
                </div>

                <div class="flex space-x-3 pt-2">
                    <button @click="$emit('update:modelValue', null)"
                            class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
                        取消
                    </button>
                    <button @click="handleSave"
                            class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">
                        保存修改
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    modelValue: Object, // 对应 editingSong
});

const emit = defineEmits(['update:modelValue', 'save']);

// 本地表单状态，避免直接修改 props
const localForm = ref({ title: '', url: '' });

// 当外部传入的 editingSong 变化时，同步给本地表单
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        localForm.value = { ...newVal };
    }
}, { immediate: true });

const handleSave = () => {
    // 将修改后的表单数据传回给父组件
    emit('save', { ...localForm.value });
};
</script>
