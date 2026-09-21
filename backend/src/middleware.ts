import type { Middleware, Context } from 'koa';
import type { Storage } from '@/storage';
import { REQUEST_ID_NAMESPACE } from '@/types'

export function createRidMiddleware(storage: Storage, ridExpiredTime: number) {
    // 用于POST请求防重复操作的rid机制，rid若重复则返回已处理，不再重复处理，以保证幂等性
    // rid规范使用36位uuid，一般无需特殊处理也不会撞
    const ridMiddleware: Middleware = async (koaCtx: Context, next) => {
        if (koaCtx.method !== 'POST') return next();
        const rid = koaCtx?.header?.["request-id"];
        // 未传rid，按照正常逻辑处理
        if (!rid) return next();
        // rid非法，直接拒绝
        if (typeof rid !== 'string' || rid.length > 40) {
            koaCtx.status = 400
            return koaCtx.body = { success: false, message: 'request-id is invalid' }
        }
        // rid重复
        // if(storage.get(REQUEST_ID_NAMESPACE, rid)) {
        //     return koaCtx.body = { }
        // }
        const acquire = await storage.setIfAbsent(REQUEST_ID_NAMESPACE, rid, 1, ridExpiredTime)

        if (!acquire) {
            koaCtx.body = { success: false, duplicated: true }
        } else {
            return await next();
        }
    }
    return ridMiddleware;
}
