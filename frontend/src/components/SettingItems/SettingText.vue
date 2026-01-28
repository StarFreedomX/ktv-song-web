<template>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-slate-700">{{ title }}</span>
            <button v-if="actionText" @click="$emit('action')" class="text-xs font-bold text-indigo-600 hover:underline">
                {{ actionText }}
            </button>
        </div>
        <div class="text-sm text-slate-500 font-medium text-left">
            <slot>{{ value || '未设置' }}</slot>
        </div>
    </div>
</template>

<script setup>
defineProps(['title', 'value', 'actionText']);
defineEmits(['action']);
</script>
