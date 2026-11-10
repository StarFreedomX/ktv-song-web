import { computed, onUnmounted, ref, watch } from 'vue';

// 进度显示到秒，250ms 的刷新足够平滑。
const TICK_MS = 250;

/**
 * 按快照推算当前播放位置：只在 isPlaying 时推进，到 duration 停住。
 * 新快照到达时重设基准；暂停冻结在当前显示位置，拖动后用目标位置继续推算。
 */
export function usePlaybackProgress(playback) {
    const anchor = ref(performance.now());
    const now = ref(anchor.value);
    // 覆盖基准：暂停时的冻结位置、或拖动后的目标位置。
    const pending = ref(null);

    // 数组 getter 每次求值都是新引用，按 seq/receivedAt 的取值判断是否真的换了快照。
    let snapshotKey = null;
    watch(
        () => `${playback.value?.seq ?? ''}:${playback.value?.receivedAt ?? ''}`,
        (key) => {
            if (key === snapshotKey) return;
            snapshotKey = key;
            pending.value = null;
            anchor.value = performance.now();
            now.value = anchor.value;
        },
    );

    const position = computed(() => {
        const state = playback.value ?? {};
        const base = pending.value ?? (typeof state.position === 'number' ? state.position : null);
        if (base === null) return null;
        const elapsed = state.isPlaying === true ? Math.max(0, now.value - anchor.value) / 1000 : 0;
        const value = base + elapsed;
        const duration = typeof state.duration === 'number' ? state.duration : null;
        return duration === null ? value : Math.min(value, duration);
    });

    // 播放/暂停切换时把切换瞬间的显示位置固定为新基准，避免回跳。
    watch(() => playback.value?.isPlaying, (_playing, previous) => {
        const state = playback.value ?? {};
        const base = pending.value ?? (typeof state.position === 'number' ? state.position : null);
        const elapsed = previous === true && base !== null
            ? Math.max(0, performance.now() - anchor.value) / 1000
            : 0;
        pending.value = base === null ? null : base + elapsed;
        anchor.value = performance.now();
        now.value = anchor.value;
    });

    /** 以指定位置为新基准继续推算，等下一帧快照覆盖。 */
    function setPosition(seconds) {
        if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return;
        pending.value = seconds;
        anchor.value = performance.now();
        now.value = anchor.value;
    }

    const timer = setInterval(() => { now.value = performance.now(); }, TICK_MS);
    onUnmounted(() => clearInterval(timer));

    return { position, setPosition };
}
