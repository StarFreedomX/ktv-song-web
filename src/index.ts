import { runKTVServer } from "@/ktvServer";
import ktvLogger from "@/logger";

ktvLogger.info('Node Env is: ', process.env.NODE_ENV);
ktvLogger.info('Debug Mode is: ', process.env.DEBUG_MODE);
// assets 目录
const staticDir = './static';

// 启动 KTV Koa 服务器
const koaApp = runKTVServer(staticDir, process.env.REDIS_URL);
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
    ktvLogger.info(`HTTP Server running on http://${host}:${port}`);
    ktvLogger.info(`Website is available on http://localhost:${port}`);
});

function shutdown(signal: string) {
    ktvLogger.info(`[shutdown] ${signal}`);

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
