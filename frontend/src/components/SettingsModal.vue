<script setup>
import SettingText from './SettingItems/SettingText.vue';
import SettingSegment from './SettingItems/SettingSegment.vue';
import SettingSwitch from './SettingItems/SettingSwitch.vue';
import SettingCollapse from "./SettingItems/SettingCollapse.vue";

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
    'edit-nickname'
]);

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
                        :value="nickname"
                        action-text="修改"
                        @action="emit('edit-nickname')"
                    />

                    <SettingSegment
                        title="跳转方式"
                        description="网页模式打开 H5 页面，App 尝试唤起客户端"
                        :options="jumpOptions"
                        :model-value="jumpMode"
                        @update:model-value="val => emit('update:jumpMode', val)"
                    />

                    <SettingSwitch
                        title="直接跳转"
                        description="点击歌曲后不再弹出确认框"
                        :model-value="autoJump"
                        @update:model-value="val => emit('update:autoJump', val)"
                    />

                    <SettingCollapse title="进阶设置" tag="Advanced">
                        <SettingSegment
                            title="同步模式"
                            description="推荐使用WebSocket 延迟更低 开销更小"
                            :options="wsOptions"
                            :model-value="wsMode"
                            @update:model-value="val => emit('update:wsMode', val)"
                        />
                    </SettingCollapse>
                </div>

                <button @click="emit('update:modelValue', false)" class="mt-6 w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 active:scale-95 transition shadow-lg shadow-indigo-100 flex-shrink-0">
                    完成
                </button>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
    width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background: #f1f5f9;
    border-radius: 10px;
}
</style>
