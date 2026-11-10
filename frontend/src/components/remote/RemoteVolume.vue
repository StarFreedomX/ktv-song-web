<script setup>
import ControlPanel from './ControlPanel.vue';
import ControlRange from './ControlRange.vue';
import ControlIcon from '../icons/ControlIcon.vue';
import ComfirmButton from '../../modals/components/ComfirmButton.vue';

defineProps({
    modelValue: { type: Number, default: null },
    absoluteVolume: { type: Boolean, default: true },
    disabled: Boolean
});
defineEmits(['update:modelValue', 'change', 'increase', 'decrease']);
</script>

<template>
    <ControlPanel class="remote-volume">
        <template #header>
            <h2>音量</h2>
            <output v-if="absoluteVolume" class="remote-value">{{ modelValue === null ? '—' : `${modelValue}%` }}</output>
        </template>
        <div class="remote-volume-controls" role="group" aria-label="音量控制">
            <ComfirmButton type="secondary" class="remote-step-button" aria-label="降低音量"
                           :disabled="disabled" @click="$emit('decrease')">
                <ControlIcon name="minus" />
            </ComfirmButton>
            <ControlRange v-if="absoluteVolume" :model-value="modelValue ?? 0" label="音量"
                          :disabled="disabled || modelValue === null"
                          :value-text="modelValue === null ? '未知' : `${modelValue}%`"
                          @update:model-value="$emit('update:modelValue', $event)" @change="$emit('change', $event)" />
            <span v-else class="remote-volume-relative">音量</span>
            <ComfirmButton type="secondary" class="remote-step-button" aria-label="提高音量"
                           :disabled="disabled" @click="$emit('increase')">
                <ControlIcon name="plus" />
            </ComfirmButton>
        </div>
    </ControlPanel>
</template>
