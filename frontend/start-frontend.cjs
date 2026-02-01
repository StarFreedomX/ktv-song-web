const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5823';
const port = parseInt(process.env.PORT || '5526');
const host = process.env.HOST || "localhost";

if (isNaN(port)) {
    console.error('port is not a number');
    process.exit(1);
}

console.log('env backend url:', backendUrl)
const apiUrl = new URL('/api', backendUrl);
const apiProxy = createProxyMiddleware({
    target: apiUrl.href,
    changeOrigin: true
});
const wsApiProxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    ws: true,
});
app.use('/api', apiProxy);

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});
const server = app.listen(port, host, () => {
    console.log(`frontend server running at: http://${host}:${port}`);
});
server.on('upgrade', wsApiProxy);
const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });

    // 强制退出
    setTimeout(() => {
        console.error('Force shutdown after timeout');
        process.exit(1);
    }, 2000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
