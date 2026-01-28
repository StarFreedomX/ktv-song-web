import type WebSocket from 'ws';

export const debugTypeArray = ['error', 'warn', 'info', 'debug'] as const;

export type debugType = typeof debugTypeArray[number];

export type IdentifiedWebSocket = WebSocket & {
    clientId: string;
};

export const enum WsReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

export interface Song {
    id: string
    title: string
    url: string
    state?: 'queued' | 'sung'
    addedBy?: string
}

export interface SongOperationBody {
    idArrayHash: string;
    song: Song;
    toIndex: number;
}

export interface OpLog {
    baseIdArray: string[]   // 操作前的数组
    baseHash: string
    song: Song
    toIndex: number
    timestamp: number
}
