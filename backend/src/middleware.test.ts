import type { Context, Middleware } from 'koa';
import { createRidMiddleware } from '@/middleware';
import { createTestStorage } from '@/testStorage';
import { REQUEST_ID_NAMESPACE } from '@/types';

describe('rid middleware', () => {
    const rid = '123e4567-e89b-12d3-a456-426614174000';
    const ttl = 60 * 1000;
    let storage: ReturnType<typeof createTestStorage>;
    let middleware: Middleware;
    let next: jest.Mock;

    const createContext = (method: string, requestId?: string | string[]) => ({
        method,
        header: requestId === undefined ? {} : { 'request-id': requestId },
    } as Context);

    beforeEach(() => {
        storage = createTestStorage();
        middleware = createRidMiddleware(storage.storage, ttl);
        next = jest.fn().mockResolvedValue(undefined);
    });

    test('非 POST 请求直接放行', async () => {
        await middleware(createContext('GET', rid), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(storage.mocks.setIfAbsent).not.toHaveBeenCalled();
    });

    test('未传 rid 的 POST 请求直接放行', async () => {
        await middleware(createContext('POST'), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(storage.mocks.setIfAbsent).not.toHaveBeenCalled();
    });

    test('首次 UUID 请求放行并设置过期时间', async () => {
        await middleware(createContext('POST', rid), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(storage.mocks.setIfAbsent).toHaveBeenCalledWith(REQUEST_ID_NAMESPACE, rid, 1, ttl);
    });

    test('相同 rid 重试不重复执行', async () => {
        await middleware(createContext('POST', rid), next);
        const ctx = createContext('POST', rid);
        await middleware(ctx, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(ctx.body).toEqual({ success: false, duplicated: true });
    });

    test('相同 rid 并发请求只执行一次', async () => {
        const first = createContext('POST', rid);
        const second = createContext('POST', rid);
        await Promise.all([middleware(first, next), middleware(second, next)]);
        expect(next).toHaveBeenCalledTimes(1);
        expect(second.body).toEqual({ success: false, duplicated: true });
    });

    test('不同 rid 的请求分别执行', async () => {
        await middleware(createContext('POST', rid), next);
        await middleware(createContext('POST', '123e4567-e89b-12d3-a456-426614174001'), next);
        expect(next).toHaveBeenCalledTimes(2);
    });

    test.each(['x'.repeat(41), [rid]])('拒绝非法 rid：%j', async requestId => {
        const ctx = createContext('POST', requestId);
        await middleware(ctx, next);
        expect(ctx.status).toBe(400);
        expect(ctx.body).toEqual({ success: false, message: 'request-id is invalid' });
        expect(next).not.toHaveBeenCalled();
        expect(storage.mocks.setIfAbsent).not.toHaveBeenCalled();
    });
});
