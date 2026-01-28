<script setup>
import SettingText from './SettingItems/SettingText.vue';
import SettingSegment from './SettingItems/SettingSegment.vue';
import SettingSwitch from './SettingItems/SettingSwitch.vue';

const props = defineProps({
    modelValue: Boolean,
    nickname: String,
    jumpMode: String,
    autoJump: Boolean
});

const emit = defineEmits([
    'update:modelValue',
    'update:jumpMode',
    'update:autoJump',
    'edit-nickname'
]);

const jumpOptions = [
    { label: '网页', value: 'web' },
    { label: 'App', value: 'app' }
];
</script>

<template>
    <transition name="modal-fade">
        <div v-if="modelValue" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" @click.self="emit('update:modelValue', false)">
            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-6">
                <h3 class="text-xl font-bold text-slate-800">设置</h3>

                <div class="space-y-4">
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
                </div>

                <button @click="emit('update:modelValue', false)" class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition">
                    完成
                </button>
            </div>
        </div>
    </transition>
</template>
