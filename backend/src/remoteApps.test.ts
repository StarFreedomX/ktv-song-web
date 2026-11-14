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

    test('注销只移除当前连接，保留 socket 并允许重新注册', async () => {
        const { socket } = await connect('room-a', 'tv-1');
        const { socket: other } = await connect('room-a', 'tv-2');
        const oldSession = apps.list('room-a')[0].sessionId;
        await report('room-a', socket, playback());
        notifyApps.mockClear();

        // 指定其他 appId 不会改变注销所属的连接。
        await report('room-a', socket, { v: 1, type: 'remote:unregister', appId: 'tv-2' });
        expect(apps.list('room-a').map(app => app.appId)).toEqual(['tv-2']);
        expect(socket.readyState).toBe(WsReadyState.OPEN);
        expect(other.readyState).toBe(WsReadyState.OPEN);
        expect(socket.sent.at(-1)).toEqual({ v: 1, type: 'remote:unregistered' });
        expect(notifyApps).toHaveBeenCalledTimes(1);
        expect(apps.forwardCommand('room-a', {
            appId: 'tv-1', sessionId: oldSession, command: 'pause',
        })).toEqual({ ok: false, reason: 'offline' });

        await report('room-a', socket, { v: 1, type: 'remote:unregister' });
        expect(notifyApps).toHaveBeenCalledTimes(1);
        await report('room-a', socket, registration('tv-1'));
        const current = apps.list('room-a').find(app => app.appId === 'tv-1')!;
        expect(current.sessionId).not.toBe(oldSession);
        expect(current.playback).toBeNull();
        expect(apps.forwardCommand('room-a', {
            appId: 'tv-1', sessionId: oldSession, command: 'pause',
        })).toEqual({ ok: false, reason: 'offline' });
    });

    test('注销取消待完成的注册，旧校验不会覆盖同一连接的新注册', async () => {
        const checks: Array<(exists: boolean) => void> = [];
        apps.close();
        apps = new RemoteApps({
            notifyApps, notifyState,
            checkRoom: () => new Promise(resolve => checks.push(resolve)),
        });
        const socket = new FakeSocket();
        const first = report('room-a', socket, registration('tv-1'));
        await report('room-a', socket, { v: 1, type: 'remote:unregister' });
        const second = report('room-a', socket, registration('tv-1'));
        checks[0](true);
        await first;
        expect(apps.list('room-a')).toEqual([]);
        checks[1](true);
        await second;
        expect(apps.list('room-a')).toHaveLength(1);
        expect(socket.sent.filter(frame => frame.type === 'remote:registered')).toHaveLength(1);
        expect(notifyApps).toHaveBeenCalledTimes(1);
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
describe('命令转发', () => {
    let apps: RemoteApps;
    let controller: FakeSocket;

    const connect = (roomId: string, appId: string) => {
        const socket = new FakeSocket();
        return { socket, ready: apps.handleMessage(roomId, socket as any, registration(appId)) };
    };
    const command = (appId: string, sessionId: string, body: Record<string, unknown>) => ({
        v: 1, type: 'remote:command', appId, sessionId, ...body,
    });

    beforeEach(() => {
        apps = new RemoteApps({
            notifyApps: jest.fn(), notifyState: jest.fn(), checkRoom: async () => true,
        });
        controller = new FakeSocket();
    });

    afterEach(() => apps.close());

    test('命令只转发给目标会话，payload 原样送达', async () => {
        const { socket: first } = await connect('room-a', 'tv-1');
        const { socket: second } = await connect('room-a', 'tv-2');
        const { socket: otherRoom } = await connect('room-b', 'tv-1');
        const [tv1] = apps.list('room-a');
        await apps.handleMessage('room-a', controller as any, command(tv1.appId, tv1.sessionId, {
            command: 'seek', payload: { seconds: 30 },
        }));

        expect(first.sent.at(-1)).toEqual({
            v: 1, type: 'remote:command',
            appId: 'tv-1', sessionId: tv1.sessionId,
            command: 'seek', payload: { seconds: 30 },
        });
        expect(second.sent.some((frame: any) => frame.type === 'remote:command')).toBe(false);
        expect(otherRoom.sent.some((frame: any) => frame.type === 'remote:command')).toBe(false);
    });

    test('顶号前的 sessionId 不会落到新会话', async () => {
        const { socket: oldSocket } = await connect('room-a', 'tv-1');
        const oldSession = apps.list('room-a')[0].sessionId;
        const { socket: newSocket } = await connect('room-a', 'tv-1');

        expect(oldSocket.closeReason).toBe('Session replaced');
        const result = apps.forwardCommand('room-a', command('tv-1', oldSession, { command: 'pause' }));

        expect(result).toEqual({ ok: false, reason: 'offline' });
        expect(newSocket.sent.at(-1)?.type).toBe('remote:registered');
        expect(newSocket.sent.some((frame: any) => frame.type === 'remote:command')).toBe(false);
    });

    test('命令名或参数不合法时不转发', async () => {
        const { socket } = await connect('room-a', 'tv-1');
        const { sessionId } = apps.list('room-a')[0];

        const cases = [
            command('tv-1', sessionId, { command: 'reboot' }),
            command('tv-1', sessionId, { command: 'seek', payload: { seconds: -1 } }),
            command('tv-1', sessionId, { command: 'setVolume', payload: { volume: 101 } }),
            command('tv-1', sessionId, { command: 'changeVolume' }),
        ];
        for (const message of cases) {
            expect(apps.forwardCommand('room-a', message)).toEqual({ ok: false, reason: 'invalid' });
        }
        expect(socket.sent.some((frame: any) => frame.type === 'remote:command')).toBe(false);
    });
});
