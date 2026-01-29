<template>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all">
        <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-slate-700">{{ title }}</span>

            <button v-if="actionText && !isEditing"
                    @click="startEdit"
                    class="text-xs font-bold text-indigo-600 hover:underline">
                {{ actionText }}
            </button>
        </div>

        <div class="text-sm font-medium text-left">
            <div v-if="!isEditing" class="text-slate-500 py-1">
                <slot>{{ modelValue || '未设置' }}</slot>
            </div>

            <input
                v-else
                ref="inputRef"
                v-model="editValue"
                type="text"
                class="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-slate-700 outline-none focus:border-indigo-500 shadow-sm"
                @blur="handleBlur"
                @keyup.enter="$event.target.blur()"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps(['title', 'modelValue', 'actionText']);
const emit = defineEmits(['update:modelValue']);

const isEditing = ref(false);
const editValue = ref('');
const inputRef = ref(null);

const startEdit = () => {
    editValue.value = props.modelValue;
    isEditing.value = true;
    // 自动聚焦
    nextTick(() => {
        inputRef.value?.focus();
    });
};

const handleBlur = () => {
    isEditing.value = false;
    // 如果值有变动，通知父组件修改 draft
    if (editValue.value !== props.modelValue) {
        emit('update:modelValue', editValue.value);
    }
};
</script>
