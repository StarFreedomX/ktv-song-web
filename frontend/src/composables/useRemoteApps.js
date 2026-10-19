import { ref, watch, onUnmounted } from 'vue';

export function useRemoteApps(roomId, enabled, polling) {
    const apps = ref([]);
    const error = ref('');
    let request = null;
    let controller = null;
    let pending = false;
    let generation = 0;
    let disposed = false;
    let pollingTimer = null;

    function refresh() {
        if (disposed || !enabled.value || typeof roomId.value !== 'string') return Promise.resolve(false);
        if (request) {
            pending = true;
            return request;
        }
        const currentGeneration = generation;
        const currentRoom = roomId.value;
        request = (async () => {
            do {
                pending = false;
                const abort = new AbortController();
                controller = abort;
                const timeout = setTimeout(() => abort.abort(), 10000);
                try {
                    const response = await fetch(`/api/remote/state?roomId=${encodeURIComponent(currentRoom)}`, {
                        signal: abort.signal,
                        cache: 'no-store',
                    });
                    const data = await response.json().catch(() => null);
                    if (disposed || currentGeneration !== generation) return false;
                    if (!response.ok || !data?.success || !Array.isArray(data.apps)) {
                        throw new Error(data?.msg || '获取投屏 App 列表失败');
                    }
                    // Keep the API identity separate from the picker's view model.
                    apps.value = data.apps.map(app => ({ ...app, id: app.appId }));
                    error.value = '';
                } catch (err) {
                    if (disposed || currentGeneration !== generation) return false;
                    error.value = err.name === 'AbortError' ? '获取投屏 App 列表超时' : '获取投屏 App 列表失败，请重试';
                    if (err.name !== 'AbortError' && err.message && !(err instanceof TypeError)) error.value = err.message;
                } finally {
                    clearTimeout(timeout);
                    if (controller === abort) controller = null;
                }
            } while (pending && !disposed && currentGeneration === generation);
            return !error.value;
        })().finally(() => {
            if (currentGeneration === generation) request = null;
        });
        return request;
    }

    watch([roomId, enabled, polling], ([room, active, usePolling], previous) => {
        generation += 1;
        controller?.abort();
        controller = null;
        request = null;
        pending = false;
        clearInterval(pollingTimer);
        if (!previous || room !== previous[0]) {
            apps.value = [];
            error.value = '';
        }
        if (!active) return;
        refresh();
        if (usePolling) pollingTimer = setInterval(refresh, 5000);
    }, { immediate: true });

    onUnmounted(() => {
        disposed = true;
        generation += 1;
        controller?.abort();
        clearInterval(pollingTimer);
    });

    return { apps, error, refresh };
}
