<template>
    <div v-show="active">
        <draggable
            :model-value="queueList"
            @update:model-value="$emit('update:queueList', $event)"
            item-key="id"
            handle=".drag-handle"
            ghost-class="ghost-card"
            :animation="300"
            @start="$emit('drag-start')"
            @end="$emit('drag-end')"
            @change="$emit('drag-change', $event)"
        >
            <template #item="{ element }">
                <div :key="element.id"
                     @click="$emit('go-to', element)"
                     :is-deleting="element.isDeleting ? 'true' : 'false'"
                     :class="['song-card bg-white mb-3 p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center group',
             element.isNew ? 'slide-in-item' : '',
             element.isNewActive ? 'slide-in-active' : '',
             element.isDeleting ? 'slide-out-item' : '',
             element.isMoved ? 'highlight-change' : '',
             element.isTop ? 'highlight-top' : '',
             element.isAffected ? 'highlight-affected' : '']">

                    <div class="drag-handle p-2 mr-2 text-slate-300 hover:text-indigo-500 transition" @click.stop>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </div>

                    <div class="flex-1 min-w-0 pr-2">
                        <div class="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition leading-tight">
                            {{ element.title }}
                        </div>
                        <div class="flex items-center gap-1.5 mt-0.5">
              <span v-if="element.addedBy" class="shrink-0 text-[9px] px-1 bg-slate-100 text-slate-400 rounded font-medium">
                {{ element.addedBy }}
              </span>
                            <div class="text-[11px] text-slate-400 truncate opacity-70">{{ element.url }}</div>
                        </div>
                    </div>

                    <div class="flex items-center">
                        <button @click.stop="$emit('toggle-favorite', element)"
                                :class="['p-2 transition', isFavorited(element) ? 'text-red-500' : 'text-slate-300 hover:text-red-400']"
                                title="收藏">
                            <svg width="18" height="18" viewBox="0 0 24 24" :fill="isFavorited(element) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                            </svg>
                        </button>

                        <button @click.stop="$emit('move-top', element)" class="p-1.5 text-slate-300 hover:text-orange-500 transition">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 19V5M5 12l7-7 7 7"/>
                            </svg>
                        </button>

                        <button @click.stop="$emit('edit', element)" class="p-1.5 text-slate-300 hover:text-indigo-500 transition">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>

                        <button @click.stop="$emit('remove', element)" class="p-2 text-slate-300 hover:text-red-500 transition">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </template>
        </draggable>

        <div v-if="queueList.length === 0" class="text-center py-20 text-slate-300">
            待唱列表是空的
        </div>
    </div>
</template>

<script setup>
import draggable from 'vuedraggable';

defineProps({
    active: Boolean,
    queueList: Array,
    isFavorited: Function
});

defineEmits([
    'update:queueList',
    'drag-start',
    'drag-end',
    'drag-change',
    'go-to',
    'toggle-favorite',
    'move-top',
    'edit',
    'remove'
]);
</script>
