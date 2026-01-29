<template>
    <button
        :class="[
            'py-4 font-bold rounded-2xl active:scale-95 transition-all duration-200',
            type === 'primary'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        ]"
    >
        <slot />
    </button>
</template>

<script setup>
defineProps({
    type: {
        type: String,
        default: 'primary' // primary 或 secondary
    }
});
</script>
