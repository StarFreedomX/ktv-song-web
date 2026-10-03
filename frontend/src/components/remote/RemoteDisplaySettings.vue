<script setup>
import ControlPanel from './ControlPanel.vue';
import ControlIcon from '../icons/ControlIcon.vue';

defineProps({
    danmaku: Boolean,
    quality: { type: [Number, String], default: '' },
    qualityOptions: { type: Array, default: () => [] },
    showDanmaku: { type: Boolean, default: true },
    showQuality: { type: Boolean, default: true }
});
defineEmits(['update:danmaku', 'update:quality', 'danmaku-change', 'quality-change']);
</script>

<template>
    <ControlPanel v-if="showDanmaku || showQuality">
        <div v-if="showDanmaku" class="remote-setting-row">
            <span class="remote-setting-label" id="remote-danmaku-label">弹幕</span>
            <button type="button" class="remote-switch" :class="{ 'is-active': danmaku }" role="switch"
                    :aria-checked="danmaku" aria-labelledby="remote-danmaku-label"
                    @click="$emit('update:danmaku', !danmaku); $emit('danmaku-change', !danmaku)">
                <span class="remote-switch-thumb"></span>
            </button>
        </div>
        <div v-if="showQuality" class="remote-setting-row remote-setting-row--quality">
            <label for="remote-quality" class="remote-setting-label">清晰度</label>
            <div class="remote-quality-select">
                <select id="remote-quality" :value="quality"
                        @change="$emit('update:quality', $event.target.value); $emit('quality-change', $event.target.value)">
                    <option value="" disabled>选择清晰度</option>
                    <option v-for="option in qualityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <ControlIcon name="chevron-down" class="remote-select-chevron" />
            </div>
        </div>
        <slot />
    </ControlPanel>
</template>
