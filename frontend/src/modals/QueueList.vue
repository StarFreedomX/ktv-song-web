<template>
    <div v-show="active" class="queue-list-container">
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
                     :class="['song-card group',
             element.isNew ? 'slide-in-item' : '',
             element.isNewActive ? 'slide-in-active' : '',
             element.isDeleting ? 'slide-out-item' : '',
             element.isMoved ? 'highlight-change' : '',
             element.isTop ? 'highlight-top' : '',
             element.isAffected ? 'highlight-affected' : '']">

                    <div class="drag-handle" @click.stop>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </div>

                    <div class="song-content">
                        <div class="song-title">
                            {{ element.title }}
                        </div>
                        <div class="song-meta">
                            <span v-if="element.addedBy" class="user-tag">
                                {{ element.addedBy }}
                            </span>
                            <div class="song-url">{{ element.url }}</div>
                        </div>
                    </div>

                    <div class="song-actions">
                        <button @click.stop="$emit('toggle-favorite', element)"
                                :class="['action-btn', isFavorited(element) ? 'is-fav' : 'is-not-fav']"
                                title="收藏">
                            <svg width="18" height="18" viewBox="0 0 24 24" :fill="isFavorited(element) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                            </svg>
                        </button>

                        <button @click.stop="$emit('move-top', element)" class="action-btn top-btn" title="置顶">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <path d="M12 19V5M5 12l7-7 7 7"/>
                            </svg>
                        </button>

                        <button @click.stop="$emit('edit', element)" class="action-btn edit-btn" title="编辑">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>

                        <button @click.stop="$emit('remove', element)" class="action-btn delete-btn" title="删除">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </template>
        </draggable>

        <div v-if="queueList.length === 0" class="empty-state">
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

<style scoped>
@reference "tailwindcss";

.queue-list-container {
    /* === 变量映射 === */
    --card-bg: white;
    --card-border: var(--border-base);
    --card-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

    --text-title: var(--text-main);
    --text-active: var(--brand-color);

    --tag-bg: #f1f5f9;
    --tag-text: #94a3b8;

    --drag-handle-color: #cbd5e1;
    --btn-idle: #cbd5e1;
}

.song-card {
    @apply mb-3 p-4 rounded-2xl border flex items-center transition-all;
    background-color: var(--card-bg);
    border-color: var(--card-border);
    box-shadow: var(--card-shadow);
}

.song-card:hover {
    border-color: var(--brand-color-light);
}

/* 拖拽中的样式 */
.ghost-card {
    @apply opacity-30 border-dashed border-2;
    border-color: var(--brand-color);
}

.drag-handle {
    @apply p-2 mr-2 cursor-grab active:cursor-grabbing transition-colors;
    color: var(--drag-handle-color);
}

.drag-handle:hover {
    color: var(--brand-color);
}

.song-content {
    @apply flex-1 min-w-0 pr-2 cursor-pointer;
}

.song-title {
    @apply text-sm font-bold truncate transition-colors leading-tight;
    color: var(--text-title);
}

.song-card:hover .song-title {
    color: var(--text-active);
}

.song-meta {
    @apply flex items-center gap-1.5 mt-0.5;
}

.user-tag {
    @apply shrink-0 text-[9px] px-1 rounded font-medium;
    background-color: var(--tag-bg);
    color: var(--tag-text);
}

.song-url {
    @apply text-[11px] truncate opacity-70;
    color: #94a3b8;
}

.song-actions {
    @apply flex items-center;
}

.action-btn {
    @apply p-1.5 transition-all;
    color: var(--btn-idle);
}

.is-fav { @apply text-red-500; }
.is-not-fav:hover { @apply text-red-400; }
.top-btn:hover { @apply text-orange-500; }
.edit-btn:hover { color: var(--brand-color); }
.delete-btn:hover { @apply text-red-500; }

.empty-state {
    @apply text-center py-20;
    color: var(--text-sub);
}

/* === 原有动画逻辑保留 === */
.highlight-change {
    animation: pulse-brand 2s infinite;
}

@keyframes pulse-brand {
    0% { border-color: var(--border-base); }
    50% { border-color: var(--brand-color); box-shadow: 0 0 10px rgba(var(--brand-color-rgb), 0.2); }
    100% { border-color: var(--border-base); }
}

/* 保持原有动画类名，仅修改内部涉及颜色的部分即可 */
.highlight-top {
    border-color: #f97316; /* 置顶项保持橙色强调 */
    background-color: #fffaf5;
}
</style>
