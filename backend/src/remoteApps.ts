import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { WsReadyState } from './types';
import ktvLogger from './logger';

export interface RemoteApp {
    appId: string;
    sessionId: string;
    name: string;
    target: { name: string; mode: 'dlna' | 'bilibili' };
}

interface RegisteredApp {
    app: RemoteApp;
    socket: WebSocket;
}

function parseRegistration(value: unknown): Omit<RemoteApp, 'sessionId'> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const data = value as Record<string, any>;
    if (data.v !== 1 || data.type !== 'register') return null;
    if (typeof data.appId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.appId)) return null;
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 80) return null;
    if (!data.target || typeof data.target.name !== 'string' ||
        !data.target.name.trim() || data.target.name.trim().length > 80) return null;
    if (data.target.mode !== 'dlna' && data.target.mode !== 'bilibili') return null;
    return {
        appId: data.appId,
        name: data.name.trim(),
        target: { name: data.target.name.trim(), mode: data.target.mode },
    };
}

export class RemoteApps {
    private readonly rooms = new Map<string, Map<string, RegisteredApp>>();
    private readonly sockets = new Set<WebSocket>();
    private closed = false;

    constructor(private readonly notify: (roomId: string) => void) {}

    list(roomId: string): RemoteApp[] {
        return [...(this.rooms.get(roomId)?.values() || [])]
            .filter(entry => entry.socket.readyState === WsReadyState.OPEN)
            .map(entry => entry.app);
    }

    connect(roomId: string, socket: WebSocket, checkRoom: () => Promise<boolean>) {
        if (this.closed) return socket.close(1001, 'Server closing');
        this.sockets.add(socket);
        let registered: RegisteredApp | null = null;
        let registering = false;
        let pongTimeout: ReturnType<typeof setTimeout> | undefined;

        const reject = (code: string, msg: string, closeCode = 1008) => {
            if (socket.readyState !== WsReadyState.OPEN) return;
            socket.send(JSON.stringify({ v: 1, type: 'error', code, msg }));
            socket.close(closeCode, code);
        };
        const registerTimeout = setTimeout(() => reject('REGISTER_TIMEOUT', '注册超时'), 10000);
        const heartbeat = setInterval(() => {
            if (socket.readyState !== WsReadyState.OPEN) return;
            socket.ping();
            pongTimeout = setTimeout(() => socket.terminate(), 10000);
        }, 20000);
        socket.on('pong', () => {
            clearTimeout(pongTimeout);
            pongTimeout = undefined;
        });

        // Attach listeners before checking Redis, so an immediate register message is retained.
        socket.on('message', async (raw, isBinary) => {
            if (socket.readyState !== WsReadyState.OPEN) return;
            const message = Buffer.isBuffer(raw) ? raw : raw instanceof ArrayBuffer ? Buffer.from(raw) : Buffer.concat(raw);
            if (isBinary || message.length > 16384) return reject('INVALID_MESSAGE', '消息格式无效');
            let data: any;
            try { data = JSON.parse(message.toString()); }
            catch { return reject('INVALID_MESSAGE', '消息必须是 JSON'); }
            if (data?.type === 'ping') {
                socket.send(JSON.stringify({ v: 1, type: 'pong' }));
                return;
            }
            if (registered || registering) return reject('ALREADY_REGISTERED', '当前连接已注册');
            const registration = parseRegistration(data);
            if (!registration) return reject('INVALID_REGISTER', '注册信息无效');
            registering = true;
            try {
                if (!await checkRoom()) return reject('ROOM_NOT_FOUND', '房间不存在');
                if (this.closed || socket.readyState !== WsReadyState.OPEN) return;
                const apps = this.rooms.get(roomId) || new Map<string, RegisteredApp>();
                this.rooms.set(roomId, apps);
                const previous = apps.get(registration.appId);
                registered = {
                    app: { ...registration, sessionId: randomUUID() },
                    socket,
                };
                apps.set(registration.appId, registered);
                clearTimeout(registerTimeout);
                socket.send(JSON.stringify({
                    v: 1, type: 'registered',
                    appId: registered.app.appId, sessionId: registered.app.sessionId,
                }));
                previous?.socket.close(1000, 'Session replaced');
                this.notify(roomId);
            } catch (error) {
                ktvLogger.error('[Remote App register]', error);
                reject('SERVICE_UNAVAILABLE', '服务暂不可用', 1011);
            } finally {
                registering = false;
            }
        });
        socket.on('close', () => {
            clearTimeout(registerTimeout);
            clearInterval(heartbeat);
            clearTimeout(pongTimeout);
            this.sockets.delete(socket);
            if (!registered) return;
            const apps = this.rooms.get(roomId);
            // An old connection must not remove the replacement session.
            if (apps?.get(registered.app.appId) !== registered) return;
            apps.delete(registered.app.appId);
            if (!apps.size) this.rooms.delete(roomId);
            if (!this.closed) this.notify(roomId);
        });
        socket.on('error', error => ktvLogger.warn('[Remote App WS]', error.message));
    }

    close() {
        this.closed = true;
        this.rooms.clear();
        for (const socket of this.sockets) socket.terminate();
    }
}
