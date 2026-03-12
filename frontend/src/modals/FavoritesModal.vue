<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="modal-mask"
             @click.self="$emit('update:modelValue', false)">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">我的收藏 ({{ favorites.length }})</h3>
                    <div class="flex gap-1">
                        <button @click="$emit('add-new')" class="icon-btn-brand" title="新增收藏">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button @click="$emit('update:modelValue', false)" class="icon-btn-close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="search-section">
                    <input :value="searchQuery"
                           @input="$emit('update:searchQuery', $event.target.value)"
                           type="text"
                           placeholder="搜索收藏的歌曲..."
                           class="search-input"
                    >
                    <div v-if="searchQuery"
                         @click="$emit('update:searchQuery', '')"
                         class="search-clear-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                </div>

                <div class="favorites-list custom-scrollbar">
                    <div v-for="fav in filteredFavorites" :key="fav.id" class="fav-item group">
                        <div class="fav-info" @click="$emit('go-to', fav)">
                            <div class="fav-title">{{ fav.title }}</div>
                            <div class="fav-url">{{ fav.url }}</div>
                        </div>
                        <div class="fav-actions">
                            <button @click="$emit('edit', fav)" class="action-btn hover:text-brand" title="编辑">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button @click="$emit('enqueue', fav)" class="action-btn text-brand" title="加入队列">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                            </button>
                            <button @click="$emit('remove', fav)" class="action-btn text-danger hover:bg-danger/5" title="取消收藏">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div v-if="filteredFavorites.length === 0" class="empty-state">
                        {{ searchQuery ? '没有找到匹配的歌曲' : '还没有收藏任何歌曲' }}
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <div class="flex gap-3">
                        <button @click="$emit('export')"
                                :disabled="favorites.length === 0"
                                class="footer-btn">
                            导出 JSON
                        </button>
                        <button @click="$refs.fileInput.click()"
                                class="footer-btn">
                            导入 JSON
                        </button>
                    </div>
                    <input type="file" ref="fileInput" class="hidden" accept=".json" @change="$emit('import', $event)">
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup>
defineProps({
    modelValue: Boolean,
    favorites: Array,
    filteredFavorites: Array,
    searchQuery: String
});

defineEmits([
    'update:modelValue',
    'update:searchQuery',
    'add-new',
    'edit',
    'remove',
    'enqueue',
    'export',
    'import',
    'go-to'
]);
</script>

<style scoped>
@reference "tailwindcss";

/* === 弹窗基础布局 === */
.modal-mask {
    @apply fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm;
    background-color: rgba(15, 23, 42, 0.4);
}

.modal-container {
    @apply w-full max-w-sm rounded-3xl shadow-2xl border p-6 flex flex-col max-h-[80vh];
    background-color: var(--brand-color-bg);
    border-color: var(--border-base);
}

.modal-header {
    @apply flex justify-between items-center mb-4;
}

.modal-title {
    @apply text-xl font-bold;
    color: var(--text-main);
}

/* === 搜索框样式 === */
.search-section {
    @apply mb-4 relative;
}

.search-input {
    @apply w-full px-4 py-2 rounded-xl text-sm outline-none border transition-all;
    background-color: #f8fafc;
    border-color: var(--border-base);
    color: var(--text-main);
}

.search-input:focus {
    background-color: white;
    border-color: var(--brand-color);
    box-shadow: 0 0 0 3px rgba(var(--brand-color-rgb), 0.1);
}

.search-clear-btn {
    @apply absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors;
    color: var(--text-sub);
}

.search-clear-btn:hover {
    color: var(--text-main);
}

/* === 收藏列表样式 === */
.favorites-list {
    @apply flex-1 overflow-y-auto space-y-3 pr-1;
}

.fav-item {
    @apply p-3 rounded-2xl border flex items-center transition-all;
    background-color: #f8fafc;
    border-color: var(--border-base);
}

.fav-item:hover {
    border-color: var(--brand-color-light);
    transform: translateY(-1px);
}

.fav-info {
    @apply flex-1 min-w-0 cursor-pointer;
}

.fav-title {
    @apply font-bold text-sm truncate;
    color: var(--text-main);
}

.fav-url {
    @apply text-[10px] truncate;
    color: var(--text-sub);
}

.fav-actions {
    @apply flex items-center gap-1;
}

/* === 按钮通用样式 === */
.icon-btn-brand {
    @apply p-1.5 rounded-xl transition-colors;
    background-color: var(--brand-color-light);
    color: var(--brand-color);
}

.icon-btn-brand:hover {
    filter: brightness(0.95);
}

.icon-btn-close {
    @apply p-1 transition-colors;
    color: var(--text-sub);
}

.icon-btn-close:hover {
    color: var(--text-main);
}

.action-btn {
    @apply p-2 rounded-xl transition-all;
    color: var(--text-sub);
}

.action-btn:hover {
    background-color: var(--brand-color-light);
}

.footer-btn {
    @apply flex-1 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-50;
    background-color: #f1f5f9;
    color: var(--text-main);
}

.footer-btn:hover:not(:disabled) {
    background-color: #e2e8f0;
}

/* === 辅助类 === */
.text-brand { color: var(--brand-color); }
.text-danger { color: var(--danger-color); }
.hover\:text-brand:hover { color: var(--brand-color); }

.empty-state {
    @apply text-center py-10 text-sm;
    color: var(--text-sub);
}

.modal-footer-actions {
    @apply mt-6 space-y-3;
}

/* 过渡动画 */
.modal-fade-enter-active, .modal-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-fade-enter-from, .modal-fade-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

/* 自定义滚动条对接主题色 */
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
