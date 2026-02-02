import request from 'supertest';
import { runKTVServer } from '@/ktvServer';

let server: any;

beforeAll(() => {
    const app = runKTVServer(undefined);
    server = app.listen();
});

afterAll((done) => {
    server.close(done);
});

async function getList(roomId: string) {
    const res = await request(server).get(`/api/songListInfo?roomId=${roomId}`);
    return res.body;
}

async function op(roomId: string, body: any) {
    return await request(server)
        .post(`/api/songOperation?roomId=${roomId}`)
        .send(body)
        .set('Content-Type', 'application/json');
}

async function next(roomId: string, hash: string) {
    return await request(server)
        .post(`/api/nextSong?roomId=${roomId}`)
        .send({ idArrayHash: hash })
        .set('Content-Type', 'application/json');
}

async function prev(roomId: string, hash: string) {
    return await request(server)
        .post(`/api/prevSong?roomId=${roomId}`)
        .send({ idArrayHash: hash })
        .set('Content-Type', 'application/json');
}

const createSong = (id: string) => ({ id, title: `Song ${id}`, url: `url/${id}` });

describe('SwitchSong next/prev flows', () => {
    test('nextSong moves queued -> singing and previous singing -> sung', async () => {
        const room = `r-${Date.now()}-1`;
        let list = await getList(room);
        expect(list.changed).toBe(true);
        let hash = list.hash;

        // add A
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 });
        expect(res.body.success).toBe(true);
        hash = res.body.hash;

        // add B
        res = await op(room, { idArrayHash: hash, song: createSong('B'), toIndex: 1 });
        expect(res.body.success).toBe(true);
        hash = res.body.hash;

        // next -> A becomes singing
        res = await next(room, hash);
        expect(res.body.success).toBe(true);
        hash = res.body.hash;
        list = await getList(room);
        expect(list.list.singing.id).toBe('A');
        expect(list.list.queued.map((s: any) => s.id)).toEqual(['B']);

        // next -> B becomes singing, A moves to sung
        res = await next(room, hash);
        expect(res.body.success).toBe(true);
        hash = res.body.hash;
        list = await getList(room);
        expect(list.list.singing.id).toBe('B');
        expect(list.list.sung.map((s: any) => s.id)).toEqual(['A']);
    });

    test('nextSong when queue empty moves singing to sung and returns song', async () => {
        const room = `r-${Date.now()}-2`;
        let list = await getList(room);
        let hash = list.hash;

        // add A
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 });
        hash = res.body.hash;

        // next -> A singing
        res = await next(room, hash);
        hash = res.body.hash;
        list = await getList(room);
        expect(list.list.singing.id).toBe('A');

        // next -> move singing to sung
        res = await next(room, hash);
        expect(res.body.success).toBe(true);
        expect(res.body.song.id).toBe('A');
        list = await getList(room);
        expect(list.list.singing).toBe(null);
        expect(list.list.sung.map((s: any) => s.id)).toEqual(['A']);
    });

    test('prevSong when sung non-empty and singing exists swaps correctly', async () => {
        const room = `r-${Date.now()}-3`;
        let list = await getList(room);
        let hash = list.hash;

        // add A, B
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 }); hash = res.body.hash;
        res = await op(room, { idArrayHash: hash, song: createSong('B'), toIndex: 1 }); hash = res.body.hash;

        // next -> A singing
        res = await next(room, hash); hash = res.body.hash;
        // next -> B singing, A to sung
        res = await next(room, hash); hash = res.body.hash;

        // prev -> A back to singing, B to queued head
        res = await prev(room, hash);
        expect(res.body.success).toBe(true);
        list = await getList(room);
        expect(list.list.singing.id).toBe('A');
        expect(list.list.queued[0].id).toBe('B');
        expect(list.list.sung.map((s: any) => s.id)).toEqual([]);
    });

    test('undoSung moves sung -> queued head', async () => {
        const room = `r-${Date.now()}-undo`;
        let list = await getList(room);
        let hash = list.hash;

        // add A, B
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 }); hash = res.body.hash;
        res = await op(room, { idArrayHash: hash, song: createSong('B'), toIndex: 1 }); hash = res.body.hash;

        // next -> A singing
        res = await next(room, hash); hash = res.body.hash;
        // next -> B singing, A to sung
        res = await next(room, hash); hash = res.body.hash;

        list = await getList(room);
        expect(list.list.sung.map((s: any) => s.id)).toEqual(['A']);

        // undo A
        res = await request(server)
            .post(`/api/undoSung?roomId=${room}`)
            .send({ idArrayHash: hash, songId: 'A' })
            .set('Content-Type', 'application/json');

        expect(res.body.success).toBe(true);
        list = await getList(room);
        expect(list.list.queued[0].id).toBe('A');
        expect(list.list.sung.map((s: any) => s.id)).toEqual([]);
    });

    test('prevSong when sung empty and singing exists moves singing -> queued', async () => {
        const room = `r-${Date.now()}-4`;
        let list = await getList(room);
        let hash = list.hash;

        // add A
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 }); hash = res.body.hash;

        // next -> A singing
        res = await next(room, hash); hash = res.body.hash;
        list = await getList(room);
        expect(list.list.singing.id).toBe('A');

        // prev -> singing moved back to queued, singing cleared
        res = await prev(room, hash);
        expect(res.body.success).toBe(true);
        list = await getList(room);
        expect(list.list.singing).toBe(null);
        expect(list.list.queued[0].id).toBe('A');
    });

    test('prevSong when sung non-empty and singing null brings last sung to singing', async () => {
        const room = `r-${Date.now()}-5`;
        let list = await getList(room);
        let hash = list.hash;

        // add A
        let res = await op(room, { idArrayHash: hash, song: createSong('A'), toIndex: 0 }); hash = res.body.hash;

        // next -> A singing
        res = await next(room, hash); hash = res.body.hash;
        // next -> move singing to sung, singing null
        res = await next(room, hash); hash = res.body.hash;

        list = await getList(room);
        expect(list.list.singing).toBe(null);
        expect(list.list.sung.map((s: any) => s.id)).toEqual(['A']);

        // prev -> bring A back to singing
        res = await prev(room, hash);
        expect(res.body.success).toBe(true);
        list = await getList(room);
        expect(list.list.singing.id).toBe('A');
        expect(list.list.sung.map((s: any) => s.id)).toEqual([]);
    });
});
