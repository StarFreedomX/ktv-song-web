<template>
    <transition name="modal-fade">
        <div v-if="modelValue"
             class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
             @click.self="$emit('update:modelValue', false)">
            <div class="modal-container bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col max-h-[80vh]">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-slate-800">我的收藏 ({{ favorites.length }})</h3>
                    <div class="flex gap-1">
                        <button @click="$emit('add-new')" class="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button @click="$emit('update:modelValue', false)" class="text-slate-400 hover:text-slate-600 p-1">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="mb-4 relative">
                    <input :value="searchQuery"
                           @input="$emit('update:searchQuery', $event.target.value)"
                           type="text"
                           placeholder="搜索收藏的歌曲..."
                           class="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                    >
                    <div v-if="searchQuery"
                         @click="$emit('update:searchQuery', '')"
                         class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    <div v-for="fav in filteredFavorites" :key="fav.id" class="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center group">
                        <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('go-to', fav)">
                            <div class="font-bold text-slate-700 text-sm truncate">{{ fav.title }}</div>
                            <div class="text-[10px] text-slate-400 truncate">{{ fav.url }}</div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button @click="$emit('edit', fav)" class="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition" title="编辑">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button @click="$emit('enqueue', fav)" class="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition" title="加入队列">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                    <path d="M12 5v14M5 12h14"></path>
                                </svg>
                            </button>
                            <button @click="$emit('remove', fav)" class="p-2 text-red-500 hover:bg-red-50 rounded-xl transition" title="取消收藏">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div v-if="filteredFavorites.length === 0" class="text-center py-10 text-slate-300 text-sm">
                        {{ searchQuery ? '没有找到匹配的歌曲' : '还没有收藏任何歌曲' }}
                    </div>
                </div>

                <div class="mt-6 space-y-3">
                    <div class="flex gap-3">
                        <button @click="$emit('export')"
                                :disabled="favorites.length === 0"
                                class="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition disabled:opacity-50">
                            导出 JSON
                        </button>
                        <button @click="$refs.fileInput.click()"
                                class="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition">
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
