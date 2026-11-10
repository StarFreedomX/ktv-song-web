<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { usePlaybackProgress } from '../composables/usePlaybackProgress';
import RemoteAppSelect from './remote/RemoteAppSelect.vue';
import RemotePlayback from './remote/RemotePlayback.vue';
import RemoteVolume from './remote/RemoteVolume.vue';
import RemoteDisplaySettings from './remote/RemoteDisplaySettings.vue';
import '../styles/remote-control.css';

const props = defineProps({
    song: { type: Object, default: null },
    roomId: { type: String, default: '' },
    apps: { type: Array, default: () => [] },
    appsError: { type: String, default: '' },
    playback: { type: Object, default: () => ({}) }
});
const emit = defineEmits(['refresh-apps', 'previous', 'next', 'command']);

const REMOTE_APP_STORAGE_KEY = 'ktv_remote_app';
// 命令先到、快照后到时，按钮先按意图显示。
const PLAY_INTENT_TIMEOUT = 6000;

const selectedAppId = defineModel('appId', { type: String, default: '' });
// Explicit choice stays separate from the fallback shown while that app is offline.
const preferredAppId = ref('');
const volume = ref(null);
const quality = ref('');
const playIntent = ref(null);

const capabilities = computed(() => props.playback.capabilities ?? {});
const qualityOptions = computed(() => (props.playback.qualities ?? []).map(item => ({
    value: `${item.qn}:${item.format ?? ''}`,
    label: item.label,
    qn: item.qn,
    format: item.format
})));
const selectedQuality = computed(() => {
    const current = (props.playback.qualities ?? []).find(item => item.now === true);
    return current ? `${current.qn}:${current.format ?? ''}` : '';
});
const isPlaying = computed(() => playIntent.value ?? props.playback.isPlaying === true);
// 没有选中设备时，除上一首/下一首外的控件都不可用。
const controlsDisabled = computed(() => !selectedAppId.value);

// 两次快照之间按已过时间推算进度；拖动后从目标位置继续推算。
const progressState = computed(() => ({ ...props.playback, isPlaying: isPlaying.value }));
const { position: progressPosition, setPosition: setProgressPosition } = usePlaybackProgress(progressState);

let playIntentTimer = null;

function readPreferredApp(roomId) {
    if (!roomId) return '';
    try {
        const saved = JSON.parse(sessionStorage.getItem(REMOTE_APP_STORAGE_KEY) || 'null');
        if (!saved || saved.roomId !== roomId || typeof saved.appId !== 'string' || !saved.appId) return '';
        return saved.appId;
    } catch {
        return '';
    }
}

function savePreferredApp(roomId, appId) {
    if (!roomId || !appId) return;
    try {
        sessionStorage.setItem(REMOTE_APP_STORAGE_KEY, JSON.stringify({ roomId, appId }));
    } catch {
        // Keep the in-memory selection when storage is unavailable.
    }
}

function syncSelection() {
    const apps = props.apps;
    const preferred = preferredAppId.value;
    if (preferred && apps.some(app => app.id === preferred)) {
        selectedAppId.value = preferred;
        return;
    }
    if (!apps.some(app => app.id === selectedAppId.value)) {
        selectedAppId.value = apps[0]?.id ?? '';
    }
}

watch(() => props.roomId, (roomId) => {
    preferredAppId.value = readPreferredApp(roomId);
    selectedAppId.value = '';
}, { immediate: true });

watch(() => props.apps, syncSelection, { immediate: true, deep: true });
watch(() => props.playback, (state) => {
    volume.value = typeof state.volume === 'number' ? state.volume : null;
    quality.value = selectedQuality.value;
    // 快照与意图一致后交还状态。
    if (playIntent.value !== null && state.isPlaying === playIntent.value) {
        clearTimeout(playIntentTimer);
        playIntent.value = null;
    }
}, { immediate: true, deep: true });

onUnmounted(() => clearTimeout(playIntentTimer));

// 命令只描述意图，执行结果由状态快照回来。
function send(command, payload) {
    emit('command', payload ? { command, payload } : { command });
}

function selectApp(appId) {
    if (!appId) return;
    preferredAppId.value = appId;
    selectedAppId.value = appId;
    savePreferredApp(props.roomId, appId);
}
function refreshApps() { emit('refresh-apps'); }
function previousSong() { emit('previous'); }
function nextSong() { emit('next'); }
function togglePlayback() {
    const next = !isPlaying.value;
    playIntent.value = next;
    clearTimeout(playIntentTimer);
    playIntentTimer = setTimeout(() => { playIntent.value = null; }, PLAY_INTENT_TIMEOUT);
    send(next ? 'play' : 'pause');
}
function recastCurrentSong() { send('recast'); }
function seekTo(seconds) {
    setProgressPosition(seconds);
    send('seek', { seconds });
}
function setVolume(value) {
    if (typeof value !== 'number') return;
    volume.value = value;
    send('setVolume', { volume: value });
}
// 支持绝对音量时按 5 调整，否则用相对指令。
function stepVolume(delta) {
    if (capabilities.value.absoluteVolume !== false && typeof volume.value === 'number') {
        setVolume(Math.min(100, Math.max(0, volume.value + delta)));
        return;
    }
    send('changeVolume', { increase: delta > 0 });
}
function increaseVolume() { stepVolume(5); }
function decreaseVolume() { stepVolume(-5); }
function setQuality(value) {
    const option = qualityOptions.value.find(item => item.value === value);
    if (!option) return;
    quality.value = value;
    send('setQuality', option.format ? { qn: option.qn, format: option.format } : { qn: option.qn });
}
</script>

<template>
    <section class="remote-page" aria-label="投屏遥控">
        <header class="remote-page-header"><h1>投屏遥控</h1></header>
        <RemoteAppSelect v-model="selectedAppId" :apps="apps" :error="appsError" @select="selectApp" @refresh="refreshApps" />
        <div class="remote-control-stack">
            <RemotePlayback :song="song" :position="progressPosition" :duration="playback.duration"
                            :is-playing="isPlaying"
                            :seekable="capabilities.seek !== false"
                            :disabled="controlsDisabled"
                            @previous="previousSong" @toggle-playback="togglePlayback" @next="nextSong" @seek="seekTo"
                            @recast="recastCurrentSong" />
            <RemoteVolume v-model="volume" :absolute-volume="capabilities.absoluteVolume !== false"
                          :disabled="controlsDisabled"
                          @change="setVolume" @increase="increaseVolume" @decrease="decreaseVolume" />
            <RemoteDisplaySettings :quality="quality" :quality-options="qualityOptions"
                                   :disabled="controlsDisabled || capabilities.quality === false"
                                   @quality-change="setQuality" />
            <slot name="controls" :app-id="selectedAppId" :playback="playback" />
        </div>
    </section>
</template>
