import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArchiveStore } from '@/archiveStore';
import { songListTools } from '@/utils';

describe('SQLite room archives', () => {
    let store: ArchiveStore;
    beforeEach(() => { store = new ArchiveStore(':memory:'); });
    afterEach(() => { store.close(); jest.restoreAllMocks(); });

    test('upsert preserves creation time, replaces all song sections and isolates reused room numbers', () => {
        const lists = songListTools.getEmptySongLists('first');
        lists.createdAt = 100;
        store.upsert('first', '123', lists);
        jest.spyOn(Date, 'now').mockReturnValue(500);
        const song = { id: 'a', title: '歌', url: 'https://example.com', addedBy: '小明' };
        store.upsert('first', '123', { ...lists, createdAt: 200, queued: [song], singing: song, sung: [song] });
        store.upsert('second', '123', songListTools.getEmptySongLists('second'));
        const result = store.getByUuid('first')!;
        expect(result.createdAt).toBe(100);
        expect(result.updatedAt).toBe(500);
        expect(result.songLists).toMatchObject({ queued: [song], singing: song, sung: [song] });
        expect(store.getByUuid('second')!.songLists.queued).toEqual([]);
        result.songLists.queued.length = 0;
        expect(store.getByUuid('first')!.songLists.queued).toHaveLength(1);
        expect(store.getByUuid("' OR 1=1 --")).toBeNull();
    });

    test('archive survives closing and reopening the database', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ktv-archive-'));
        const file = join(dir, 'nested', 'rooms.db');
        let disk: ArchiveStore | undefined;
        try {
            disk = new ArchiveStore(file);
            disk.upsert('persisted', '123', songListTools.getEmptySongLists('persisted'));
            disk.close();
            disk = new ArchiveStore(file);
            expect(disk.getByUuid('persisted')?.roomId).toBe('123');
        } finally { disk?.close(); rmSync(dir, { recursive: true, force: true }); }
    });

    test('write failure does not throw into the live room flow', () => {
        store.close();
        expect(() => store.upsert('closed', '123', songListTools.getEmptySongLists())).not.toThrow();
    });
});
