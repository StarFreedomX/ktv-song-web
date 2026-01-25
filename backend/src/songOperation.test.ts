// songOperation.test.ts

import { OpLog, Song } from "@/types";
import { songOperation } from "@/utils";

describe('songOperation Rebase Logic', () => {
    // 辅助函数：快速创建歌曲对象
    const createSong = (id: string): Song => ({
        id,
        title: `Song ${id}`,
        url: `url/${id}`
    });

    test('should rebase a move operation correctly when concurrent moves occur', () => {
        const baseSongIdArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const nowSongs = baseSongIdArray.map(createSong)
        const [,,songC,,,,songG] = nowSongs;

        /** * 并发操作 ops (已经入库的操作):
         * 用户把 G 移动到 index 0
         * 此时数组状态理论上变为 ['G', 'A', 'B', 'C', 'D', 'E', 'F', 'H']
         */
        const ops: OpLog[] = [{
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songG,
            toIndex: 0,
            timestamp: 100 // 较早发生
        }];

        /** * 当前操作 nowOp (待处理的操作):
         * 用户基于 S0，把 C 移动到 D 后 (index 3)
         */
        const nowOp: OpLog = {
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songC,
            toIndex: 3,
            timestamp: 200 // 较晚发生
        };

        // 执行函数
        const result = songOperation(nowSongs, baseSongIdArray, ops, nowOp);

        /**
         * 预期分析:
         * 初始: 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'
         * Op1 执行后: 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'H'
         * nowOp (C to index 3) 变基:
         * 最终顺序应该是: 'G', 'A', 'B', 'D', 'C', 'E', 'F', 'H'
         */

        const resultIds = result.map(s => s.id);

        // 验证结果顺序
        expect(resultIds).toEqual(['G', 'A', 'B', 'D', 'C', 'E', 'F', 'H']);

        // 验证 nowOp 的 toIndex 是否被更新为变基后的最终位置 (index 4)
        expect(nowOp.toIndex).toBe(4);
    });

    test('should handle song deletion in rebase', () => {
        const baseSongIdArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const nowSongs = baseSongIdArray.map(createSong)
        const [songA,songB] = nowSongs;

        // 并发操作：删除了 B
        const ops: OpLog[] = [{
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songB,
            toIndex: -1,
            timestamp: 100
        }];

        // 当前操作：把 A 移到 E 后面 (index 4)
        const nowOp: OpLog = {
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songA,
            toIndex: 4,
            timestamp: 200
        };

        const result = songOperation(nowSongs, baseSongIdArray, ops, nowOp);
        console.log(result);
        // 预期结果：['C', 'D', 'E', 'A', 'F', 'G', 'H']
        expect(result.map(s => s.id)).toEqual(['C', 'D', 'E', 'A', 'F', 'G', 'H']);
    });

    test('should add a new song correctly in a rebased environment', () => {
        const baseSongIdArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const nowSongs = baseSongIdArray.map(createSong)
        const [songA] = nowSongs;
        const songNew = createSong('New')

        // 别人把 A 移到了 F 后面
        const ops: OpLog[] = [{
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songA,
            toIndex: 5,
            timestamp: 100
        }];

        // 我在 index 3 插入新歌
        const nowOp: OpLog = {
            baseIdArray: baseSongIdArray,
            baseHash: 'hash_s0',
            song: songNew,
            toIndex: 3,
            timestamp: 200
        };

        const result = songOperation(nowSongs, baseSongIdArray, ops, nowOp);
        expect(result.map(s => s.id)).toEqual(['B', 'C', 'New', 'D', 'E', 'F', 'A', 'G', 'H']);
    });
});
