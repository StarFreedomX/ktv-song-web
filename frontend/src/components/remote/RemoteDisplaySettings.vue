<script setup>
import ControlPanel from './ControlPanel.vue';
import ControlIcon from '../icons/ControlIcon.vue';

defineProps({
    quality: { type: String, default: '' },
    qualityOptions: { type: Array, default: () => [] },
    disabled: Boolean
});
defineEmits(['quality-change']);
</script>

<template>
    <ControlPanel>
        <div class="remote-setting-row remote-setting-row--quality">
            <label for="remote-quality" class="remote-setting-label">清晰度</label>
            <div class="remote-quality-select">
                <select id="remote-quality" :value="quality" :disabled="disabled || !qualityOptions.length"
                        @change="$emit('quality-change', $event.target.value)">
                    <option value="" disabled>{{ qualityOptions.length ? '选择清晰度' : '暂无清晰度' }}</option>
                    <option v-for="option in qualityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <ControlIcon name="chevron-down" class="remote-select-chevron" />
            </div>
        </div>
        <slot />
    </ControlPanel>
</template>
