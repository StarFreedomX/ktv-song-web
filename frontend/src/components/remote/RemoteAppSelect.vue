<script setup>
import { computed, ref } from 'vue';
import ControlIcon from '../icons/ControlIcon.vue';
import RefreshIcon from '../icons/RefreshIcon.vue';

const props = defineProps({
    modelValue: { type: String, default: '' },
    apps: { type: Array, default: () => [] },
    error: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue', 'select', 'refresh']);
const dialog = ref(null);
const expanded = ref(false);
const refreshVersion = ref(0);
const refreshAnimating = ref(false);
const selectedApp = computed(() => props.apps.find(app => app.id === props.modelValue));

function openPicker() {
    refreshAnimating.value = false;
    dialog.value.showModal();
    expanded.value = true;
}

function selectApp(appId) {
    emit('update:modelValue', appId);
    emit('select', appId);
    dialog.value.close();
}

function refreshApps() {
    refreshVersion.value += 1;
    refreshAnimating.value = true;
    emit('refresh');
}

function finishRefreshAnimation(event) {
    if (event.target.isConnected) refreshAnimating.value = false;
}
</script>

<template>
    <div class="remote-app-picker">
        <span class="remote-app-label">投屏 App</span>
        <button type="button" class="remote-app-chip" aria-label="切换投屏 App" aria-haspopup="dialog"
                aria-controls="remote-app-dialog" :aria-expanded="expanded" @click="openPicker">
            <span>{{ selectedApp?.name || '选择投屏 App' }}</span>
            <ControlIcon name="pencil" />
        </button>
    </div>
    <Teleport to="body">
        <dialog ref="dialog" id="remote-app-dialog" class="remote-app-dialog" aria-labelledby="remote-app-dialog-title"
                @close="expanded = false; refreshAnimating = false" @click="($event.target === dialog) && dialog.close()">
            <header class="remote-app-dialog-header">
                <h2 id="remote-app-dialog-title">选择投屏 App</h2>
                <button type="button" class="remote-app-refresh" aria-label="刷新投屏 App 列表" title="刷新"
                        @click="refreshApps">
                    <RefreshIcon :key="refreshVersion" :class="{ 'animate-spin-once': refreshAnimating }"
                                 @animationend="finishRefreshAnimation" @animationcancel="finishRefreshAnimation" />
                </button>
            </header>
            <div class="remote-app-list">
                <button v-for="app in apps" :key="app.id" type="button" class="remote-app-option"
                        :class="{ 'is-selected': app.id === modelValue }" :aria-pressed="app.id === modelValue"
                        @click="selectApp(app.id)">{{ app.name }}</button>
                <p v-if="error" class="remote-app-error" role="alert">{{ error }}</p>
                <p v-else-if="!apps.length" class="remote-app-empty">暂无在线 App</p>
            </div>
            <button type="button" class="remote-dialog-cancel" @click="dialog.close()">取消</button>
        </dialog>
    </Teleport>
</template>
