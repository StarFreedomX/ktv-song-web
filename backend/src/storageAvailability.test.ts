import { createClient } from 'redis';
import request from 'supertest';
import { Storage, StorageUnavailableError } from '@/storage';
import { ArchiveStore } from '@/archiveStore';
import { runKTVServer } from '@/ktvServer';
import { songListTools } from '@/utils';

jest.mock('redis', () => ({ createClient: jest.fn() }));
jest.mock('@/logger', () => ({ __esModule: true, default: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), trace: jest.fn(),
} }));

describe('Redis readiness and room API errors', () => {
    let client: any;
    let storage: Storage;
    let archive: ArchiveStore;
    let runtime: ReturnType<typeof runKTVServer>;
    let api: ReturnType<typeof request>;
    beforeEach(() => {
        client = {
            isOpen: false, isReady: false,
            on: jest.fn(), connect: jest.fn().mockResolvedValue(undefined), destroy: jest.fn(),
            get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1), mGet: jest.fn().mockResolvedValue([]),
            unlink: jest.fn(), incr: jest.fn(), multi: jest.fn(),
        };
        (createClient as jest.Mock).mockReturnValue(client);
        storage = new Storage('redis://localhost:6379');
        archive = new ArchiveStore(':memory:');
        runtime = runKTVServer(storage, archive);
        api = request(runtime.app.callback());
    });
    afterEach(() => { runtime.close(); archive.close(); storage.close(); });

    test.each([false, true])('closed or handshaking socket is unavailable (isOpen=%s)', async isOpen => {
        client.isOpen = isOpen;
        const operations = [
            () => storage.get('room', '123'),
            () => storage.setIfAbsent('room', '123', {}, 1000),
            () => storage.set('room', '123', {}, 1000),
            () => storage.getMany('room', ['123']),
            () => storage.increment('clicks', '123'),
            () => storage.remove('room', '123'),
        ];
        for (const operation of operations) await expect(operation()).rejects.toBeInstanceOf(StorageUnavailableError);
        expect(client.get).not.toHaveBeenCalled();
        expect(client.set).not.toHaveBeenCalled();
    });

    test.each(['createRoom', 'roomExists', 'songListInfo'])('%s returns actionable 503 while Redis is not ready', async endpoint => {
        const call = endpoint === 'createRoom' ? api.post(`/api/${endpoint}`) : api.get(`/api/${endpoint}`);
        const response = await call.query({ roomId: '123' }).expect(503);
        expect(response.body).toMatchObject({ success: false, code: 'REDIS_UNAVAILABLE' });
        expect(response.body.msg).toContain('Redis');
        expect(response.body.exists).toBeUndefined();
        expect(response.headers['retry-after']).toBe('5');
        expect(client.set).not.toHaveBeenCalled();
    });

    test('recovery restores real absent/occupied results and NX TTL semantics', async () => {
        await api.post('/api/createRoom?roomId=123').expect(503);
        client.isOpen = client.isReady = true;
        expect((await api.get('/api/roomExists?roomId=123').expect(200)).body).toEqual({ exists: false });
        expect((await api.post('/api/createRoom?roomId=123').expect(200)).body.success).toBe(true);
        expect(client.set).toHaveBeenCalledWith('ktv_room_123', expect.any(String), { NX: true, PX: expect.any(Number) });
        client.set.mockResolvedValue(null);
        expect((await api.post('/api/createRoom?roomId=123').expect(200)).body.msg).toBe('房间已存在');
        client.isReady = false;
        // 房间已进入内存缓存也不能掩盖 Redis 掉线。
        await api.get('/api/songListInfo?roomId=123').expect(503);
    });

    test('read/write failures after readiness checks still return 503 without archiving a failed creation', async () => {
        client.isOpen = client.isReady = true;
        client.get.mockRejectedValue(new Error('Socket closed'));
        client.set.mockRejectedValue(new Error('READONLY replica'));
        const upsert = jest.spyOn(archive, 'upsert');
        for (const response of [
            await api.get('/api/roomExists?roomId=123'),
            await api.post('/api/createRoom?roomId=123'),
        ]) {
            expect(response.status).toBe(503);
            expect(response.body.code).toBe('REDIS_UNAVAILABLE');
        }
        expect(upsert).not.toHaveBeenCalled();
    });

    test('SQLite remains readable with unknown live status during a Redis outage', async () => {
        archive.upsert('archived', '123', songListTools.getEmptySongLists('archived'));
        const response = await api.get('/api/roomArchive?uuid=archived').expect(200);
        expect(response.body).toMatchObject({ success: true, roomId: '123', active: null });
    });

    test('ready reads retain legacy expireAt behavior', async () => {
        client.isReady = true;
        client.get.mockResolvedValue(JSON.stringify({ value: { queued: [] }, expireAt: Date.now() + 60000 }));
        expect(await storage.get('room', '123')).toEqual({ queued: [] });
        client.get.mockResolvedValue(JSON.stringify({ value: {}, expireAt: Date.now() - 1 }));
        expect(await storage.get('room', '123')).toBeUndefined();
        expect(client.del).toHaveBeenCalledWith('room_123');
    });
});
