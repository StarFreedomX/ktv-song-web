import { runKTVServer } from "@/ktvServer";
import { Storage } from "@/storage";
import ktvLogger from "@/logger";
process.env.NODE_ENV||='production';
ktvLogger.info('Node Env is: ', process.env.NODE_ENV);
ktvLogger.info('Debug Mode is: ', process.env.DEBUG_MODE);

const storage = new Storage(process.env.REDIS_URL)
// 启动 KTV Koa 服务器
const koaApp = runKTVServer(storage);
koaApp.use(async (ctx) => {
    ctx.status = 404;
    ctx.body = '404 Not Found - 路径错误';
});
const port: number = parseInt(process.env.PORT || '5823');
const host: string = process.env.HOST || "localhost";

if (isNaN(port)) {
    ktvLogger.error('port is not a number');
    process.exit(1);
}

const server = koaApp.listen(port, host, () => {
    ktvLogger.info(`Backend HTTP Server running on http://${host}:${port}`);
});

async function shutdown(signal: string) {
    ktvLogger.info(`[shutdown] ${signal}`);
    await storage.close();
    server.close(() => {
        ktvLogger.info('server closed');
        process.exit(0);
    });

    setTimeout(() => {
        ktvLogger.warn('force exit');
        process.exit(1);
    }, 2000);
}

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(sig => {
    process.on(sig, shutdown);
});
