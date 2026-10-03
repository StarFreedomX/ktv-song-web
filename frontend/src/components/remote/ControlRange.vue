<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    label: { type: String, required: true },
    valueText: String,
    disabled: Boolean
});
const emit = defineEmits(['update:modelValue', 'change']);
const fill = computed(() => props.max > props.min
    ? Math.min(100, Math.max(0, (props.modelValue - props.min) / (props.max - props.min) * 100))
    : 0);
</script>

<template>
    <input
        class="remote-range" type="range" :min="min" :max="max" :value="modelValue"
        :disabled="disabled" :aria-label="label" :aria-valuetext="valueText"
        :style="{ '--range-fill': `${fill}%` }"
        @input="emit('update:modelValue', Number($event.target.value))"
        @change="emit('change', Number($event.target.value))"
    />
</template>
