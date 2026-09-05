import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ktvLogger from '@/logger';
import { SongLists } from '@/types';

export interface ArchiveRow {
    uuid: string;
    roomId: string;
    songLists: SongLists;
    createdAt: number;
    updatedAt: number;
}

/**
 * 房间存档存储层（SQLite，只读维度）。
 *
 * - Live 维度仍由 Redis（roomId 为键）负责，这里只是历史房间数据的只读存档。
 * - 写透：每次 persistRoom 时 upsert，写失败只记日志、不阻断 live 流程。
 * - DB 路径由 ROOM_ARCHIVE_DB_PATH 控制（默认 /app/data/rooms.db）。
 */
export class ArchiveStore {
    private db: DatabaseSync;

    constructor(dbPath?: string) {
        // 默认落在运行目录下的 data/rooms.db（Docker 中 cwd=/app → /app/data/rooms.db；
        // 裸跑时落在项目目录内），仍可用 ROOM_ARCHIVE_DB_PATH 显式覆盖
        const resolved = dbPath || process.env.ROOM_ARCHIVE_DB_PATH || path.join(process.cwd(), 'data', 'rooms.db');
        // 确保目录存在（Docker volume 挂载点、本地裸跑时都需要）
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        this.db = new DatabaseSync(resolved);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS rooms (
                uuid TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                songlists TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON rooms(room_id, updated_at DESC);
        `);
        ktvLogger.info('[ArchiveStore]', `SQLite archive opened at ${resolved}`);
    }

    /** 写透存档：不存在则插入，存在则更新 room_id/songlists/updated_at（created_at 保留首次值） */
    upsert(uuid: string, roomId: string, songLists: SongLists) {
        try {
            this.db.prepare(`
                INSERT INTO rooms (uuid, room_id, songlists, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    room_id = excluded.room_id,
                    songlists = excluded.songlists,
                    updated_at = excluded.updated_at
            `).run(uuid, roomId, JSON.stringify(songLists), songLists.createdAt || Date.now(), Date.now());
        } catch (err) {
            ktvLogger.error('[ArchiveStore]', 'upsert failed', err instanceof Error ? err.message : err);
        }
    }

    getByUuid(uuid: string): ArchiveRow | null {
        try {
            const row = this.db.prepare('SELECT uuid, room_id, songlists, created_at, updated_at FROM rooms WHERE uuid = ?').get(uuid) as
                | { uuid: string; room_id: string; songlists: string; created_at: number; updated_at: number }
                | undefined;
            if (!row) return null;
            return {
                uuid: row.uuid,
                roomId: row.room_id,
                songLists: JSON.parse(row.songlists) as SongLists,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        } catch (err) {
            ktvLogger.error('[ArchiveStore]', 'getByUuid failed', err instanceof Error ? err.message : err);
            return null;
        }
    }

    close() {
        try {
            this.db.close();
        } catch {
            // ignore
        }
    }
}
