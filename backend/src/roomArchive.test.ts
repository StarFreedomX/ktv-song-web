import request from 'supertest';
import { ArchiveStore } from '@/archiveStore';
import { runKTVServer } from '@/ktvServer';
import { createTestStorage } from '@/testStorage';
import { songListTools } from '@/utils';

describe('Room archive API', () => {
    let archive: ArchiveStore;
    let runtime: ReturnType<typeof runKTVServer>;
    let fixture: ReturnType<typeof createTestStorage>;
    let api: ReturnType<typeof request>;
    beforeEach(() => {
        archive = new ArchiveStore(':memory:');
        fixture = createTestStorage();
        runtime = runKTVServer(fixture.storage, archive);
        api = request(runtime.app.callback());
    });
    afterEach(() => { runtime.close(); archive.close(); });

    async function create() {
        await api.post('/api/createRoom?roomId=123').expect(200);
        return (await api.get('/api/songListInfo?roomId=123')).body;
    }

    test('creation assigns UUID and archives the empty room; duplicate creation keeps the original', async () => {
        const first = await create();
        expect(first.list.uuid).toMatch(/^[0-9a-f-]{36}$/);
        const unchanged = await api.get('/api/songListInfo').query({ roomId: '123', lastHash: first.hash });
        expect(unchanged.body).toMatchObject({ changed: false, uuid: first.list.uuid });
        expect((await api.post('/api/createRoom?roomId=123')).body.success).toBe(false);
        const res = await api.get('/api/roomArchive').query({ uuid: first.list.uuid }).expect(200);
        expect(res.body).toMatchObject({ success: true, active: true, roomId: '123', songLists: first.list });
        expect(fixture.mocks.setIfAbsent.mock.calls[0]).toHaveLength(4);
        expect((await api.get('/api/songListInfo?roomId=123')).body.list.uuid).toBe(first.list.uuid);
    });

    test('writes and playback changes are archived without changing UUID', async () => {
        const first = await create();
        const song = { id: 'a', title: '歌', url: 'https://example.com/a' };
        const added = await api.post('/api/songOperation?roomId=123').send({ idArrayHash: first.hash, song, toIndex: 0 });
        expect(added.body.success).toBe(true);
        expect(archive.getByUuid(first.list.uuid)!.songLists.queued).toEqual([song]);
        const next = await api.post('/api/nextSong?roomId=123').send({ idArrayHash: added.body.hash });
        expect(next.body.success).toBe(true);
        expect(archive.getByUuid(first.list.uuid)!.songLists.singing).toEqual(song);
        expect(archive.getByUuid(first.list.uuid)!.songLists.uuid).toBe(first.list.uuid);
    });

    test('expired rooms remain readable and reused room numbers cannot activate old archives', async () => {
        const first = await create();
        fixture.values.delete('ktv_room_123');
        fixture.mocks.set.mockClear();
        const upsert = jest.spyOn(archive, 'upsert');
        const expired = await api.get('/api/roomArchive').query({ uuid: first.list.uuid });
        expect(expired.body.active).toBe(false);
        expect(fixture.values.size).toBe(0);
        expect(fixture.mocks.set).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
        const second = await create();
        expect(second.list.uuid).not.toBe(first.list.uuid);
        expect((await api.get('/api/roomArchive').query({ uuid: first.list.uuid })).body.active).toBe(false);
        expect((await api.get('/api/roomExists').query({ roomId: '123', uuid: first.list.uuid })).body.exists).toBe(false);
        expect((await api.get('/api/roomExists').query({ roomId: '123', uuid: second.list.uuid })).body.exists).toBe(true);
    });

    test('missing and unknown UUIDs return errors without creating data', async () => {
        await api.get('/api/roomArchive').expect(400);
        await api.get('/api/roomArchive?uuid=unknown').expect(404);
        expect(fixture.values.size).toBe(0);
    });

    test('legacy rooms without UUID still work and are not migrated', async () => {
        fixture.values.set('ktv_room_legacy', songListTools.getEmptySongLists());
        const upsert = jest.spyOn(archive, 'upsert');
        const response = await api.post('/api/shuffle?roomId=legacy');
        expect(response.body.success).toBe(true);
        expect(upsert).not.toHaveBeenCalled();
        expect((await api.get('/api/songListInfo?roomId=legacy')).body.list.uuid).toBeUndefined();
    });
});
