<template>
    <div class="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300">
        <div
            @click="isExpanded = !isExpanded"
            class="p-4 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors select-none"
        >
            <div class="flex items-center gap-2">
                <span class="font-bold text-slate-700">{{ title }}</span>
                <span v-if="tag" class="px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-600 rounded-md font-bold uppercase tracking-wider">
          {{ tag }}
        </span>
            </div>
            <svg
                class="w-5 h-5 text-slate-400 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                :class="{ 'rotate-180': isExpanded }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
        </div>

        <transition
            @before-enter="el => el.style.height = '0'"
            @enter="el => el.style.height = el.scrollHeight + 'px'"
            @after-enter="el => el.style.height = 'auto'"
            @before-leave="el => el.style.height = el.scrollHeight + 'px'"
            @leave="el => el.style.height = '0'"
        >
            <div v-show="isExpanded"
                class="overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.3,0,0,1)]"
            >
                <div class="px-4 pb-4 space-y-3">
                    <slot />
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref } from 'vue';
defineProps(['title', 'tag']);
const isExpanded = ref(false);
</script>
