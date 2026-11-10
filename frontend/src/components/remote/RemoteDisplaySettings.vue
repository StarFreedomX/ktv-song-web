<script setup>
import ControlPanel from './ControlPanel.vue';
import ControlIcon from '../icons/ControlIcon.vue';

defineProps({
    quality: { type: String, default: '' },
    // 与播放页一致：按取源方式分组，组内是具体档位。
    qualityGroups: { type: Array, default: () => [] },
    disabled: Boolean
});
defineEmits(['quality-change']);
</script>

<template>
    <ControlPanel>
        <div class="remote-setting-row remote-setting-row--quality">
            <label for="remote-quality" class="remote-setting-label">清晰度</label>
            <div class="remote-quality-select">
                <select id="remote-quality" :value="quality" :disabled="disabled || !qualityGroups.length"
                        @change="$emit('quality-change', $event.target.value)">
                    <option value="" disabled>{{ qualityGroups.length ? '选择清晰度' : '暂无清晰度' }}</option>
                    <template v-for="group in qualityGroups" :key="group.format">
                        <optgroup v-if="group.label" :label="group.label">
                            <option v-for="option in group.options" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </option>
                        </optgroup>
                        <template v-else>
                            <option v-for="option in group.options" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </option>
                        </template>
                    </template>
                </select>
                <ControlIcon name="chevron-down" class="remote-select-chevron" />
            </div>
        </div>
        <slot />
    </ControlPanel>
</template>
