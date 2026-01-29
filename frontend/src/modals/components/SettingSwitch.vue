<template>
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
            <div class="font-bold text-slate-700">{{ title }}</div>
            <div v-if="description" class="text-[10px] text-slate-400">{{ description }}</div>
        </div>
        <button @click="$emit('update:modelValue', !modelValue)"
                :class="['w-12 h-6 rounded-full transition-colors duration-300 relative flex items-center', modelValue ? 'bg-indigo-600' : 'bg-slate-300']">
            <span :class="['absolute bg-white w-4 h-4 rounded-full shadow transition-all duration-300', modelValue ? 'left-7' : 'left-1']"></span>
        </button>
    </div>
</template>

<script setup>
defineProps(['modelValue', 'title', 'description']);
defineEmits(['update:modelValue']);
</script>
