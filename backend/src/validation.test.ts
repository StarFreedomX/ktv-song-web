import { normalizeSongUrl, validateRoomId, validateSong } from "@/validation";

describe('validateRoomId', () => {
    test('接受合法房间号', () => {
        expect(validateRoomId('abc123')).toBeNull();
        expect(validateRoomId('A_B-c')).toBeNull();
        expect(validateRoomId('x'.repeat(20))).toBeNull();
    });
    test('拒绝非法房间号', () => {
        expect(validateRoomId('')).not.toBeNull();
        expect(validateRoomId('a b')).not.toBeNull();
        expect(validateRoomId('房间')).not.toBeNull();
        expect(validateRoomId('a/b')).not.toBeNull();
        expect(validateRoomId('x'.repeat(21))).not.toBeNull();
        expect(validateRoomId(123)).not.toBeNull();
        expect(validateRoomId(undefined)).not.toBeNull();
    });
});

describe('validateSong', () => {
    const validSong = { id: 'BV1xx411c7mD', title: '测试歌曲', url: 'https://example.com/a', addedBy: '小明' };
    test('接受合法歌曲', () => {
        expect(validateSong(validSong)).toBeNull();
        expect(validateSong({ ...validSong, url: 'bilibili://video/BV1xx411c7mD?page=0' })).toBeNull();
        expect(validateSong({ ...validSong, addedBy: '' })).toBeNull();
        expect(validateSong({ ...validSong, addedBy: undefined })).toBeNull();
        expect(validateSong({ ...validSong, id: 's-abc123', addedBy: undefined })).toBeNull();
    });
    test('拒绝缺失或非法字段', () => {
        expect(validateSong(null)).not.toBeNull();
        expect(validateSong([])).not.toBeNull();
        expect(validateSong('string')).not.toBeNull();
        expect(validateSong({ ...validSong, id: '' })).not.toBeNull();
        expect(validateSong({ ...validSong, id: 42 })).not.toBeNull();
        expect(validateSong({ ...validSong, id: 'x y' })).not.toBeNull();
        expect(validateSong({ ...validSong, id: 'x'.repeat(65) })).not.toBeNull();
        expect(validateSong({ ...validSong, title: '' })).not.toBeNull();
        expect(validateSong({ ...validSong, title: '   ' })).not.toBeNull();
        expect(validateSong({ ...validSong, title: 'x'.repeat(101) })).not.toBeNull();
        expect(validateSong({ ...validSong, url: '' })).not.toBeNull();
        expect(validateSong({ ...validSong, url: 'not a url' })).not.toBeNull();
        expect(validateSong({ ...validSong, url: 'javascript:alert(1)' })).not.toBeNull();
        expect(validateSong({ ...validSong, url: 'ftp://x.com' })).not.toBeNull();
        expect(validateSong({ ...validSong, url: 'http://' })).toBeNull(); // 无主机名的退化链接，归一化后视为无害垃圾，允许通过
        expect(validateSong({ ...validSong, url: 'x'.repeat(2049) })).not.toBeNull();
        expect(validateSong({ ...validSong, addedBy: 123 })).not.toBeNull();
        expect(validateSong({ ...validSong, addedBy: 'x'.repeat(21) })).not.toBeNull();
    });
});

describe('normalizeSongUrl', () => {
    test('已带白名单协议的链接原样返回', () => {
        expect(normalizeSongUrl('https://example.com/a')).toBe('https://example.com/a');
        expect(normalizeSongUrl('http://example.com/a')).toBe('http://example.com/a');
        expect(normalizeSongUrl('bilibili://video/BV1xx411c7mD?page=0')).toBe('bilibili://video/BV1xx411c7mD?page=0');
    });
    test('纯 BV/av 号转成 B 站视频链接', () => {
        expect(normalizeSongUrl('BV1xx411c7mD')).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
        expect(normalizeSongUrl('av12345')).toBe('https://www.bilibili.com/video/av12345');
    });
    test('其余裸输入前置 https://（中和自定义协议）', () => {
        expect(normalizeSongUrl('b23.tv/abc123')).toBe('https://b23.tv/abc123');
        expect(normalizeSongUrl('c')).toBe('https://c');
        expect(normalizeSongUrl('javascript:alert(1)')).toBe('https://javascript:alert(1)');
    });
});
