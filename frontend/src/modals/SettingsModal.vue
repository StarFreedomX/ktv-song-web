<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-overlay"
             @click.self="emit('update:modelValue', false)">

            <div class="settings-modal-container">
                <div class="modal-header">
                    <h2 class="modal-title">系统设置</h2>
                </div>

                <div class="modal-scroll-area custom-scrollbar">
                    <div class="space-y-4">
                        <SettingText
                            title="点歌台名称"
                            action-text="修改"
                            :model-value="draft.nickname"
                            @update:model-value="val => draft.nickname = val"
                        />

                        <SettingSegment
                            title="默认跳转"
                            description="选择歌曲链接的打开方式"
                            :options="jumpOptions"
                            :model-value="draft.jumpMode"
                            @update:model-value="val => draft.jumpMode = val"
                        />

                        <SettingSwitch
                            title="自动播放"
                            description="开启后将自动循环播放待唱列表"
                            :model-value="draft.autoPlay"
                            @update:model-value="val => draft.autoPlay = val"
                        />

                        <SettingSwitch
                            title="伴奏提醒"
                            description="检测到仅伴奏 / off vocal 结果时，点歌前弹出确认提示"
                            :model-value="draft.bilibiliInstrumentalWarning"
                            @update:model-value="val => draft.bilibiliInstrumentalWarning = val"
                        />

                        <SettingCollapse title="进阶设置" tag="Advanced">
                            <SettingSegment
                                title="同步模式"
                                description="推荐使用 WebSocket (ws)"
                                :options="wsOptions"
                                :model-value="draft.wsMode"
                                @update:model-value="val => draft.wsMode = val"
                            />
                        </SettingCollapse>
                    </div>
                </div>

                <div class="modal-footer">
                    <ComfirmButton
                        class="flex-1"
                        type="secondary"
                        @click="emit('update:modelValue', false)"
                    >
                        取消
                    </ComfirmButton>

                    <ComfirmButton
                        class="flex-1"
                        type="primary"
                        @click="handleConfirm"
                    >
                        确认保存
                    </ComfirmButton>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
import { reactive, watch } from 'vue';
import SettingText from './components/SettingText.vue';
import SettingSegment from './components/SettingSegment.vue';
import SettingSwitch from './components/SettingSwitch.vue';
import SettingCollapse from "./components/SettingCollapse.vue";
import ComfirmButton from "./components/ComfirmButton.vue";

const props = defineProps({
    modelValue: Boolean,
    cfg: Object
});

const emit = defineEmits(['update:modelValue', 'update:cfg']);

const draft = reactive({});

watch(() => props.modelValue, (isOpen) => {
    if (isOpen && props.cfg) {
        Object.assign(draft, props.cfg);
    }
});

const handleConfirm = () => {
    emit('update:cfg', { ...draft });
    emit('update:modelValue', false);
};

const jumpOptions = [
    { label: '网页', value: 'web' },
    { label: 'App', value: 'app' }
];

const wsOptions = [
    { label: 'ws', value: true },
    { label: 'http', value: false }
];
</script>

<style scoped>
@reference "tailwindcss";

.modal-overlay {
    @apply fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-sm;
    background-color: rgba(15, 23, 42, 0.4);
}

.settings-modal-container {
    @apply w-full max-w-sm rounded-xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden;
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

.modal-header {
    @apply p-8 pb-4 shrink-0;
}

.modal-title {
    @apply text-2xl font-black;
    color: var(--text-main);
}

.modal-subtitle {
    @apply text-xs mt-1 font-bold uppercase tracking-wider;
    color: var(--text-sub);
}

.modal-scroll-area {
    @apply flex-1 overflow-y-auto px-8;
}

.modal-footer {
    @apply p-8 pt-4 flex gap-3 shrink-0;
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border-base);
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--brand-color-light);
}

</style>
