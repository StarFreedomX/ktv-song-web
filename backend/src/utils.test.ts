import { isBilibiliUrl } from '@/utils';

describe('isBilibiliUrl', () => {
    test('接受 B 站及 b23.tv 域名', () => {
        expect(isBilibiliUrl('https://b23.tv/abc123')).toBe(true);
        expect(isBilibiliUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true);
        expect(isBilibiliUrl('https://m.bilibili.com/video/BV1xx411c7mD')).toBe(true);
    });

    test('拒绝伪装域名和非 HTTP 链接', () => {
        expect(isBilibiliUrl('https://evil.example/?url=b23.tv')).toBe(false);
        expect(isBilibiliUrl('https://b23.tv.evil.example/')).toBe(false);
        expect(isBilibiliUrl('https://b23.tv@127.0.0.1/')).toBe(false);
        expect(isBilibiliUrl('bilibili://video/BV1xx411c7mD')).toBe(false);
        expect(isBilibiliUrl(123)).toBe(false);
    });
});
