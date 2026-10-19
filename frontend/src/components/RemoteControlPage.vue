<script setup>
import { ref, watch } from 'vue';
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
    playback: { type: Object, default: () => ({}) },
    qualityOptions: {
        type: Array,
        default: () => [
            { value: 32, label: '480P' },
            { value: 64, label: '720P' },
            { value: 80, label: '1080P' },
            { value: 112, label: '1080P+' },
            { value: 120, label: '4K' }
        ]
    }
});
const emit = defineEmits(['refresh-apps', 'previous', 'next']);

const REMOTE_APP_STORAGE_KEY = 'ktv_remote_app';

const selectedAppId = defineModel('appId', { type: String, default: '' });
// Explicit choice stays separate from the fallback shown while that app is offline.
const preferredAppId = ref('');
const volume = ref(null);
const danmaku = ref(false);
const quality = ref('');

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
    volume.value = state.volume ?? null;
    danmaku.value = state.danmaku ?? false;
    quality.value = state.quality ?? '';
}, { immediate: true, deep: true });

// Previous/next change the room queue; other controls await the App command channel.
function selectApp(appId) {
    if (!appId) return;
    preferredAppId.value = appId;
    selectedAppId.value = appId;
    savePreferredApp(props.roomId, appId);
}
function refreshApps() { emit('refresh-apps'); }
function previousSong() { emit('previous'); }
function togglePlayback() {}
function nextSong() { emit('next'); }
function recastCurrentSong() {}
function seekTo(seconds) {}
function setVolume(value) {}
function increaseVolume() {}
function decreaseVolume() {}
function setDanmaku(enabled) {}
function setQuality(value) {}
</script>

<template>
    <section class="remote-page" aria-label="投屏遥控">
        <header class="remote-page-header"><h1>投屏遥控</h1></header>
        <RemoteAppSelect v-model="selectedAppId" :apps="apps" :error="appsError" @select="selectApp" @refresh="refreshApps" />
        <div class="remote-control-stack">
            <RemotePlayback :song="song" :position="playback.position" :duration="playback.duration"
                            :is-playing="playback.isPlaying ?? true"
                            @previous="previousSong" @toggle-playback="togglePlayback" @next="nextSong" @seek="seekTo"
                            @recast="recastCurrentSong" />
            <RemoteVolume v-model="volume" :absolute-volume="playback.capabilities?.absoluteVolume ?? true"
                          @change="setVolume" @increase="increaseVolume" @decrease="decreaseVolume" />
            <RemoteDisplaySettings v-model:danmaku="danmaku" v-model:quality="quality" :quality-options="qualityOptions"
                                   :show-danmaku="playback.capabilities?.danmaku ?? true"
                                   :show-quality="playback.capabilities?.quality ?? true"
                                   @danmaku-change="setDanmaku" @quality-change="setQuality" />
            <slot name="controls" :app-id="selectedAppId" :playback="playback" />
        </div>
    </section>
</template>
