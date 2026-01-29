<script setup>
import { reactive, watch } from 'vue';
import SettingText from './components/SettingText.vue';
import SettingSegment from './components/SettingSegment.vue';
import SettingSwitch from './components/SettingSwitch.vue';
import SettingCollapse from "./components/SettingCollapse.vue";
import ComfirmButton from "./components/ComfirmButton.vue";

const props = defineProps({
    modelValue: Boolean,
    nickname: String,
    jumpMode: String,
    wsMode: Boolean,
    autoJump: Boolean
});

const emit = defineEmits([
    'update:modelValue',
    'update:jumpMode',
    'update:wsMode',
    'update:autoJump',
    'update:nickname'
]);
// SettingsModal.vue 内部
const draft = reactive({});

// 弹窗打开时，全自动把 props 塞进 draft
watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        Object.keys(props).forEach(key => {
            draft[key] = props[key];
        });
    }
});

// 保存按钮：把 draft 里的东西全量 emit 掉
const handleConfirm = () => {
    Object.keys(draft).forEach(key => {
        if (draft[key] !== props[key]) {
            emit(`update:${key}`, draft[key]);
        }
    });
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

<template>
    <transition name="modal-fade">
        <div v-if="modelValue" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" @click.self="emit('update:modelValue', false)">
            <div class="modal-container bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 flex flex-col max-h-[90vh]">
                <h3 class="text-xl font-bold text-slate-800 mb-6 flex-shrink-0">设置</h3>

                <div class="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
                    <SettingText
                        title="我的昵称"
                        action-text="修改"
                        :model-value="draft.nickname"
                        @update:model-value="val => draft.nickname = val"
                    />

                    <SettingSegment
                        title="跳转方式"
                        description="网页模式打开 H5 页面，App 尝试唤起客户端"
                        :options="jumpOptions"
                        :model-value="draft.jumpMode"
                        @update:model-value="val => draft.jumpMode = val"
                    />

                    <SettingSwitch
                        title="直接跳转"
                        description="点击歌曲后不再弹出确认框"
                        :model-value="draft.autoJump"
                        @update:model-value="val => draft.autoJump = val"
                    />

                    <SettingCollapse title="进阶设置" tag="Advanced">
                        <SettingSegment
                            title="同步模式"
                            description="推荐使用 WebSocket"
                            :options="wsOptions"
                            :model-value="draft.wsMode"
                            @update:model-value="val => draft.wsMode = val"
                        />
                    </SettingCollapse>
                </div>

                <div class="mt-8 flex gap-3 flex-shrink-0">
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

<style scoped>
.modal-container {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: height, transform;
}

.scrollbar-thin::-webkit-scrollbar {
    width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background: #f1f5f9;
    border-radius: 10px;
}
</style>
