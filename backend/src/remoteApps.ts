import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { WsReadyState } from './types';

export type RemoteTargetMode = 'dlna' | 'bilibili' | 'local';

export interface RemoteTarget {
    name: string;
    mode: RemoteTargetMode;
}

export interface RemoteApp {
    appId: string;
    sessionId: string;
    name: string;
    target: RemoteTarget;
}

export type RemoteErrorCode =
    | 'INVALID_MESSAGE'
    | 'INVALID_REGISTER'
    | 'ALREADY_REGISTERED'
    | 'ROOM_NOT_FOUND'
    | 'SERVICE_UNAVAILABLE';

export interface RemoteAppsOptions {
    /** 房间内执行端列表变化时回调，由调用方负责推送给控制端。 */
    notify: (roomId: string) => void;
    /** 房间存在性校验。 */
    checkRoom: (roomId: string) => Promise<boolean>;
}

interface RegisteredApp {
    app: RemoteApp;
    socket: WebSocket;
}

function isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseText(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text && text.length <= maxLength ? text : null;
}

/** 校验 remote:register 消息；返回 null 表示字段不合法。 */
export function parseRegistration(value: unknown): Omit<RemoteApp, 'sessionId'> | null {
    if (!isRecord(value)) return null;
    if (value.v !== 1 || value.type !== 'remote:register') return null;
    if (typeof value.appId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.appId)) return null;
    const name = parseText(value.name, 80);
    if (!name) return null;
    if (!isRecord(value.target)) return null;
    const targetName = parseText(value.target.name, 80);
    if (!targetName) return null;
    const mode = value.target.mode;
    if (mode !== 'dlna' && mode !== 'bilibili' && mode !== 'local') return null;
    return { appId: value.appId, name, target: { name: targetName, mode } };
}

/**
 * 遥控协议。连接与心跳由 /api/ws 统一管理，这里只处理 remote: 前缀的消息和维护注册表。
 */
export class RemoteApps {
    private readonly rooms = new Map<string, Map<string, RegisteredApp>>();
    private readonly sessions = new Map<WebSocket, RegisteredApp>();
    private readonly registering = new Set<WebSocket>();
    private closed = false;

    constructor(private readonly options: RemoteAppsOptions) {}

    list(roomId: string): RemoteApp[] {
        return [...(this.rooms.get(roomId)?.values() || [])]
            .filter(entry => entry.socket.readyState === WsReadyState.OPEN)
            .map(entry => entry.app);
    }

    isRegistered(socket: WebSocket): boolean {
        return this.sessions.has(socket);
    }

    /** 处理一条 remote: 前缀的消息，回复直接写回该连接。 */
    async handleMessage(roomId: string, socket: WebSocket, message: unknown): Promise<void> {
        const type = isRecord(message) ? message.type : undefined;
        if (type !== 'remote:register') {
            return this.sendError(socket, 'INVALID_MESSAGE', '未知消息类型');
        }
        if (this.closed) return this.sendError(socket, 'SERVICE_UNAVAILABLE', '服务暂不可用');
        if (this.sessions.has(socket) || this.registering.has(socket)) {
            return this.sendError(socket, 'ALREADY_REGISTERED', '当前连接已注册');
        }
        const registration = parseRegistration(message);
        if (!registration) return this.sendError(socket, 'INVALID_REGISTER', '注册信息无效');

        this.registering.add(socket);
        try {
            if (!await this.options.checkRoom(roomId)) {
                return this.sendError(socket, 'ROOM_NOT_FOUND', '房间不存在');
            }
            if (this.closed) return this.sendError(socket, 'SERVICE_UNAVAILABLE', '服务暂不可用');
            if (socket.readyState !== WsReadyState.OPEN) return;

            const apps = this.rooms.get(roomId) || new Map<string, RegisteredApp>();
            this.rooms.set(roomId, apps);
            const previous = apps.get(registration.appId);
            const entry: RegisteredApp = {
                app: { ...registration, sessionId: randomUUID() },
                socket,
            };
            apps.set(registration.appId, entry);
            this.sessions.set(socket, entry);
            // 被顶替的连接不再属于任何会话，close 事件不会误删新条目。
            if (previous) {
                this.sessions.delete(previous.socket);
                if (previous.socket !== socket) previous.socket.close(1000, 'Session replaced');
            }
            this.send(socket, {
                v: 1, type: 'remote:registered',
                appId: entry.app.appId, sessionId: entry.app.sessionId,
            });
            this.options.notify(roomId);
        } finally {
            this.registering.delete(socket);
        }
    }

    /** 无法解析或超限的消息仍按遥控协议回错误。 */
    handleInvalidMessage(socket: WebSocket) {
        this.sendError(socket, 'INVALID_MESSAGE', '消息格式无效');
    }

    unregister(roomId: string, socket: WebSocket) {
        const entry = this.sessions.get(socket);
        if (!entry) return;
        this.sessions.delete(socket);
        const apps = this.rooms.get(roomId);
        if (!apps || apps.get(entry.app.appId) !== entry) return;
        apps.delete(entry.app.appId);
        if (!apps.size) this.rooms.delete(roomId);
        if (!this.closed) this.options.notify(roomId);
    }

    close() {
        this.closed = true;
        this.rooms.clear();
        this.sessions.clear();
        this.registering.clear();
    }

    private send(socket: WebSocket, payload: unknown) {
        if (socket.readyState !== WsReadyState.OPEN) return;
        socket.send(JSON.stringify(payload));
    }

    private sendError(socket: WebSocket, code: RemoteErrorCode, msg: string) {
        this.send(socket, { v: 1, type: 'remote:error', code, msg });
    }
}
