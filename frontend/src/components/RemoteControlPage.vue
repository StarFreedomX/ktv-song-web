<script setup>
import { ref, watch } from 'vue';
import RemoteAppSelect from './remote/RemoteAppSelect.vue';
import RemotePlayback from './remote/RemotePlayback.vue';
import RemoteVolume from './remote/RemoteVolume.vue';
import RemoteDisplaySettings from './remote/RemoteDisplaySettings.vue';
import '../styles/remote-control.css';

const props = defineProps({
    song: { type: Object, default: null },
    apps: { type: Array, default: () => [] },
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

const selectedAppId = defineModel('appId', { type: String, default: '' });
const volume = ref(null);
const danmaku = ref(false);
const quality = ref('');

watch(() => props.apps, (apps) => {
    if (!apps.some(app => app.id === selectedAppId.value)) selectedAppId.value = apps[0]?.id ?? '';
}, { immediate: true, deep: true });
watch(() => props.playback, (state) => {
    volume.value = state.volume ?? null;
    danmaku.value = state.danmaku ?? false;
    quality.value = state.quality ?? '';
}, { immediate: true, deep: true });

// Remote commands are placeholders until the App control channel is available.
function selectApp(appId) {}
function refreshApps() {}
function previousSong() {}
function togglePlayback() {}
function nextSong() {}
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
        <RemoteAppSelect v-model="selectedAppId" :apps="apps" @select="selectApp" @refresh="refreshApps" />
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
