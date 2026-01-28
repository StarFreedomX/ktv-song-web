<template>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-slate-700">{{ title }}</span>

            <div class="relative flex bg-slate-200 p-1 rounded-xl min-w-[128px] h-9 overflow-hidden">

                <div
                    class="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,1.2,0.3,1)]"
                    :style="indicatorStyle"
                ></div>

                <button
                    v-for="(opt, index) in options"
                    :key="opt.value"
                    @click="$emit('update:modelValue', opt.value)"
                    class="relative z-10 flex-1 text-xs font-bold transition-colors duration-200"
                    :class="modelValue === opt.value ? 'text-indigo-600' : 'text-slate-500'"
                >
                    {{ opt.label }}
                </button>
            </div>
        </div>
        <p v-if="description" class="text-[10px] text-slate-400 text-left">{{ description }}</p>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: [String, Number],
    title: String,
    description: String,
    options: {
        type: Array,
        default: () => []
    }
});

defineEmits(['update:modelValue']);

// 计算滑块的宽度和位移
const indicatorStyle = computed(() => {
    const count = props.options.length;
    if (count === 0) return {};

    const activeIndex = props.options.findIndex(opt => opt.value === props.modelValue);

    // 宽度百分比 = 100% / 选项个数
    const width = 100 / count;

    // 偏移百分比 = 当前索引 * 100% (相对于滑块自身宽度)
    const x = activeIndex * 100;

    return {
        width: `calc(${width}% - 2px)`,
        transform: `translateX(${x}%)`
    };
});
</script>
