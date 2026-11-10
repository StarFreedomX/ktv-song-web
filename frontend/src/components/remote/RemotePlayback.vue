<script setup>
import { computed, ref, watch } from 'vue';
import ControlPanel from './ControlPanel.vue';
import ControlRange from './ControlRange.vue';
import ControlIcon from '../icons/ControlIcon.vue';
import RefreshIcon from '../icons/RefreshIcon.vue';

const props = defineProps({
    song: { type: Object, default: null },
    position: { type: Number, default: null },
    duration: { type: Number, default: null },
    isPlaying: { type: Boolean, default: true },
    seekable: { type: Boolean, default: true },
    disabled: Boolean
});
const emit = defineEmits(['previous', 'toggle-playback', 'next', 'seek', 'recast']);

const recastVersion = ref(0);
const recastAnimating = ref(false);
function recastSong() {
    recastVersion.value += 1;
    recastAnimating.value = true;
    emit('recast');
}

function finishRecastAnimation(event) {
    if (event.target.isConnected) recastAnimating.value = false;
}

const seekPosition = ref(0);
const dragging = ref(false);
watch(() => [props.song?.id, props.position], () => {
    // 拖动时不让推算值把滑块拽走。
    if (dragging.value) return;
    seekPosition.value = props.position ?? 0;
}, { immediate: true });

function onSeekInput(value) {
    dragging.value = true;
    seekPosition.value = value;
}

function onSeekCommit(value) {
    dragging.value = false;
    seekPosition.value = value;
    emit('seek', value);
}
const canSeek = computed(() => props.seekable && props.duration > 0);
const formatTime = (seconds) => {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};
</script>

<template>
    <ControlPanel class="remote-playback">
        <div class="remote-song-heading">
            <h2 class="remote-song-title">{{ song?.title || '暂无歌曲' }}</h2>
            <button type="button" class="remote-recast-button" aria-label="重新投屏" title="重新投屏"
                    :disabled="disabled || !song" @click="recastSong">
                <RefreshIcon :key="recastVersion" :class="{ 'animate-spin-once': recastAnimating }"
                             @animationend="finishRecastAnimation" @animationcancel="finishRecastAnimation" />
            </button>
        </div>
        <div class="remote-progress">
            <ControlRange :model-value="seekPosition" :max="duration > 0 ? duration : 100"
                          :disabled="disabled || !canSeek" label="播放进度" :value-text="formatTime(seekPosition)"
                          @update:model-value="onSeekInput" @change="onSeekCommit" />
            <div class="remote-progress-times">
                <span>{{ formatTime(canSeek ? seekPosition : position) }}</span>
                <span>{{ formatTime(duration) }}</span>
            </div>
        </div>
        <div class="remote-transport" role="group" aria-label="播放控制">
            <button type="button" class="remote-transport-button" aria-label="上一首" @click="$emit('previous')">
                <ControlIcon name="skip-back" />
            </button>
            <button type="button" class="remote-transport-button" :aria-label="isPlaying ? '暂停' : '播放'"
                    :disabled="disabled" @click="$emit('toggle-playback')">
                <ControlIcon :name="isPlaying ? 'pause' : 'play'" />
            </button>
            <button type="button" class="remote-transport-button" aria-label="下一首" @click="$emit('next')">
                <ControlIcon name="skip-forward" />
            </button>
        </div>
    </ControlPanel>
</template>
