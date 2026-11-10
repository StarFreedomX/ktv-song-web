import { EventEmitter } from 'node:events';
import { RemoteApps, parsePlayback, parseRegistration } from '@/remoteApps';
import { WsReadyState } from '@/types';

class FakeSocket extends EventEmitter {
    readyState = WsReadyState.OPEN;
    sent: any[] = [];
    closeReason: string | undefined;

    send(message: string) {
        this.sent.push(JSON.parse(message));
    }

    close(_code: number, reason?: string) {
        this.readyState = WsReadyState.CLOSED;
        this.closeReason = reason;
    }
}

const registration = (appId = 'phone-abc', overrides: Record<string, unknown> = {}) => ({
    v: 1,
    type: 'remote:register',
    appId,
    name: '客厅手机',
    target: { name: '客厅电视', mode: 'dlna' },
    ...overrides,
});

const playback = (overrides: Record<string, unknown> = {}) => ({
    v: 1,
    type: 'remote:playback',
    playback: {
        seq: 1,
        position: 128.4,
        duration: 240,
        volume: 40,
        isPlaying: true,
        qualities: [{ qn: 80, format: 'dash', label: '1080P高清', now: true }],
        capabilities: { absoluteVolume: true, seek: true, quality: true },
        ...overrides,
    },
});

describe('遥控注册与状态', () => {
    let notifyApps: jest.Mock;
    let notifyState: jest.Mock;
    let apps: RemoteApps;

    const connect = (roomId: string, appId: string) => {
        const socket = new FakeSocket();
        return { socket, ready: apps.handleMessage(roomId, socket as any, registration(appId)) };
    };
    const report = (roomId: string, socket: FakeSocket, message: unknown) =>
        apps.handleMessage(roomId, socket as any, message);

    beforeEach(() => {
        notifyApps = jest.fn();
        notifyState = jest.fn();
        apps = new RemoteApps({ notifyApps, notifyState, checkRoom: async () => true });
    });

    afterEach(() => apps.close());

    test('房间与 appId 相互隔离，多设备状态各自保存', async () => {
        // 两个房间用同一个 appId，不构成顶替。
        const { socket: socketA } = await connect('room-a', 'tv-1');
        await connect('room-b', 'tv-1');
        // 同一房间的另一台设备。
        const { socket: socketC } = await connect('room-a', 'tv-2');

        expect(apps.list('room-a').map(app => app.appId).sort()).toEqual(['tv-1', 'tv-2']);
        expect(apps.list('room-b').map(app => app.appId)).toEqual(['tv-1']);

        // 两台设备分别上报，状态不能串。
        await report('room-a', socketA, playback({ seq: 3, position: 10 }));
        await report('room-a', socketC, playback({ seq: 8, position: 99 }));

        const byId = (appId: string) => apps.list('room-a').find(app => app.appId === appId);
        expect(byId('tv-1')?.playback?.position).toBe(10);
        expect(byId('tv-2')?.playback?.position).toBe(99);
        expect(notifyState).toHaveBeenCalledWith('room-a', 'tv-1', expect.objectContaining({
            seq: 3, receivedAt: expect.any(Number),
        }));
    });

    test('同一 appId 重连顶替旧会话，旧连接的注销不影响新会话', async () => {
        const { socket: oldSocket } = await connect('room-a', 'tv-1');
        const oldSession = apps.list('room-a')[0].sessionId;
        await report('room-a', oldSocket, playback({ seq: 5 }));

        const { socket: newSocket } = await connect('room-a', 'tv-1');

        expect(oldSocket.closeReason).toBe('Session replaced');
        const [current] = apps.list('room-a');
        expect(current.sessionId).not.toBe(oldSession);
        // 新会话从空状态开始
        expect(current.playback).toBeNull();

        // 旧连接的断开事件不能删掉新会话。
        apps.unregister('room-a', oldSocket as any);
        expect(apps.list('room-a')).toHaveLength(1);
        expect(apps.list('room-a')[0].sessionId).toBe(current.sessionId);
    });

    test('字段缺失的上报被拒绝，已有快照保持不变', async () => {
        const { socket } = await connect('room-a', 'tv-1');
        await report('room-a', socket, playback({ seq: 5, position: 10 }));

        // 缺少 seq 的负载不合法。
        await report('room-a', socket, { v: 1, type: 'remote:playback', playback: { position: 30 } });

        expect(socket.sent.at(-1)).toMatchObject({ type: 'remote:error', code: 'INVALID_MESSAGE' });
        expect(apps.list('room-a')[0].playback).toMatchObject({ seq: 5, position: 10 });
        expect(notifyState).toHaveBeenCalledTimes(1);
    });

    test('parsePlayback 按文档归一化字段', () => {
        const parsed = parsePlayback({
            seq: 7,
            position: -3,
            duration: 0,
            volume: 130,
            isPlaying: false,
            qualities: [
                { qn: 80, label: 'A', now: true },
                { qn: 64, label: 'B', now: true },
                { qn: 'x', label: 'C' },
            ],
            capabilities: { absoluteVolume: false },
        });

        expect(parsed).toMatchObject({
            position: null,
            duration: null,
            volume: 100,
            isPlaying: false,
            capabilities: { absoluteVolume: false, seek: true, quality: true },
        });
        expect(parsed?.qualities).toEqual([
            { qn: 80, label: 'A', now: true },
            { qn: 64, label: 'B' },
        ]);
        expect(parsePlayback({ seq: 1.5 })).toBeNull();
    });

    test('parseRegistration 按文档校验字段', () => {
        expect(parseRegistration(registration())).toEqual({
            appId: 'phone-abc',
            name: '客厅手机',
            target: { name: '客厅电视', mode: 'dlna' },
        });
        expect(parseRegistration(registration('tv', { target: { name: '本机', mode: 'local' } })))
            .toMatchObject({ target: { mode: 'local' } });
        expect(parseRegistration(registration('bad id'))).toBeNull();
        expect(parseRegistration(registration('tv', { target: { name: '电视', mode: 'airplay' } }))).toBeNull();
    });
});
