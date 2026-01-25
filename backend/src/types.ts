
export const debugTypeArray = ['error', 'warn', 'info', 'debug'] as const;

export type debugType = typeof debugTypeArray[number];

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
