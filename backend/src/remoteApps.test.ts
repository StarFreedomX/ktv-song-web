import { EventEmitter } from 'node:events';
import { RemoteApps, parseRegistration } from '@/remoteApps';
import { WsReadyState } from '@/types';

class FakeSocket extends EventEmitter {
    readyState = WsReadyState.OPEN;
    sent: any[] = [];
    closeReason: string | undefined;

    send(message: string) {
        this.sent.push(JSON.parse(message));
    }

    close(_code?: number, reason?: string) {
        this.readyState = WsReadyState.CLOSED;
        this.closeReason = reason;
    }

    terminate() {
        this.readyState = WsReadyState.CLOSED;
    }
}

const roomId = 'room-1';

const registration = (overrides: Record<string, unknown> = {}) => ({
    v: 1,
    type: 'remote:register',
    appId: 'phone-abc',
    name: '客厅手机',
    target: { name: '客厅电视', mode: 'dlna' },
    ...overrides,
});

describe('RemoteApps 遥控注册', () => {
    let notify: jest.Mock;
    let checkRoom: jest.Mock;
    let apps: RemoteApps;
    let socket: FakeSocket;

    const register = (target: FakeSocket = socket, message: unknown = registration()) =>
        apps.handleMessage(roomId, target as any, message);

    beforeEach(() => {
        notify = jest.fn();
        checkRoom = jest.fn().mockResolvedValue(true);
        apps = new RemoteApps({ notify, checkRoom });
        socket = new FakeSocket();
    });

    afterEach(() => apps.close());

    test('注册成功回 registered 并进入房间列表', async () => {
        await register();

        expect(socket.sent).toHaveLength(1);
        const [reply] = socket.sent;
        expect(reply).toMatchObject({ v: 1, type: 'remote:registered', appId: 'phone-abc' });
        expect(reply.sessionId).toBeTruthy();
        expect(apps.list(roomId)).toHaveLength(1);
        expect(apps.isRegistered(socket as any)).toBe(true);
        expect(notify).toHaveBeenCalledWith(roomId);
    });

    test('未知类型回 INVALID_MESSAGE', async () => {
        await register(socket, { v: 1, type: 'remote:unknown' });

        expect(socket.sent[0]).toMatchObject({ v: 1, type: 'remote:error', code: 'INVALID_MESSAGE' });
        expect(apps.list(roomId)).toHaveLength(0);
    });

    test('旧前缀按未知类型处理，版本不匹配回 INVALID_REGISTER', async () => {
        await register(socket, { ...registration(), type: 'register' });
        expect(socket.sent[0]).toMatchObject({ code: 'INVALID_MESSAGE' });

        const next = new FakeSocket();
        await register(next, { ...registration(), v: 2 });
        expect(next.sent[0]).toMatchObject({ code: 'INVALID_REGISTER' });
        expect(apps.list(roomId)).toHaveLength(0);
    });

    test('字段越界或模式非法回 INVALID_REGISTER', async () => {
        await register(socket, registration({ appId: 'has space' }));
        expect(socket.sent[0]).toMatchObject({ code: 'INVALID_REGISTER' });

        const next = new FakeSocket();
        await register(next, { ...registration(), target: { name: '电视', mode: 'airplay' } });
        expect(next.sent[0]).toMatchObject({ code: 'INVALID_REGISTER' });
        expect(apps.list(roomId)).toHaveLength(0);
    });

    test('本机播放模式可以注册', async () => {
        await register(socket, { ...registration(), target: { name: '本机', mode: 'local' } });

        expect(socket.sent[0].type).toBe('remote:registered');
        expect(apps.list(roomId)[0].target.mode).toBe('local');
    });

    test('房间不存在回 ROOM_NOT_FOUND', async () => {
        checkRoom.mockResolvedValue(false);
        await register();

        expect(socket.sent[0]).toMatchObject({ type: 'remote:error', code: 'ROOM_NOT_FOUND' });
        expect(apps.list(roomId)).toHaveLength(0);
        expect(notify).not.toHaveBeenCalled();
    });

    test('同一连接重复注册回 ALREADY_REGISTERED', async () => {
        await register();
        await register();

        expect(socket.sent[1]).toMatchObject({ type: 'remote:error', code: 'ALREADY_REGISTERED' });
        expect(apps.list(roomId)).toHaveLength(1);
    });

    test('相同 appId 换连接时顶替旧会话', async () => {
        await register();
        const first = apps.list(roomId)[0];
        const next = new FakeSocket();
        await register(next);

        expect(socket.closeReason).toBe('Session replaced');
        expect(next.sent[0].type).toBe('remote:registered');
        const sessions = apps.list(roomId);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].sessionId).not.toBe(first.sessionId);
        expect(sessions[0].sessionId).toBe(next.sent[0].sessionId);

        // 旧连接的 close 事件不能删掉新会话。
        apps.unregister(roomId, socket as any);
        expect(apps.list(roomId)).toHaveLength(1);
    });

    test('连接断开后从列表移除并再次通知', async () => {
        await register();
        apps.unregister(roomId, socket as any);

        expect(apps.list(roomId)).toHaveLength(0);
        expect(apps.isRegistered(socket as any)).toBe(false);
        expect(notify).toHaveBeenCalledTimes(2);
    });

    test('列表过滤已经关闭的连接', async () => {
        await register();
        socket.readyState = WsReadyState.CLOSED;

        expect(apps.list(roomId)).toHaveLength(0);
    });

    test('服务关闭后不再接受注册', async () => {
        apps.close();
        await register();

        expect(socket.sent[0]).toMatchObject({ type: 'remote:error', code: 'SERVICE_UNAVAILABLE' });
    });

    test('无法解析的消息回 INVALID_MESSAGE', () => {
        apps.handleInvalidMessage(socket as any);

        expect(socket.sent[0]).toMatchObject({ v: 1, type: 'remote:error', code: 'INVALID_MESSAGE' });
    });

    test('parseRegistration 校验字段', () => {
        expect(parseRegistration(registration())).toEqual({
            appId: 'phone-abc',
            name: '客厅手机',
            target: { name: '客厅电视', mode: 'dlna' },
        });
        expect(parseRegistration({ ...registration(), name: '   ' })).toBeNull();
        expect(parseRegistration({ ...registration(), target: { name: '电视' } })).toBeNull();
    });
});
