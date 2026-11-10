import { computed, onUnmounted, ref, watch } from 'vue';

// 进度显示到秒，250ms 的刷新足够平滑。
const TICK_MS = 250;

/**
 * 按快照推算当前播放位置：只在 isPlaying 时推进，到 duration 停住。
 * 新快照到达时重设基准；拖动进度条后用目标位置继续推算，直到下一帧快照。
 */
export function usePlaybackProgress(playback) {
    const anchor = ref(performance.now());
    const now = ref(anchor.value);
    // 拖动后的目标位置，收到新快照即让位给真实值。
    const pending = ref(null);

    watch(
        () => [playback.value?.seq, playback.value?.receivedAt],
        () => {
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
