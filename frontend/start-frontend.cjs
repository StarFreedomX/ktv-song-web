const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const dotenv = require('dotenv');
const fs = require("node:fs");

const envPath = path.join(__dirname, '.env');
const envLocalPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envLocalPath) && fs.existsSync(envPath)) {
    console.log('.env.local 不存在，正在根据 .env 自动创建...');
    fs.copyFileSync(envPath, envLocalPath);
}

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:5823';
console.log('env backend url:', backendUrl)
const apiUrl = new URL('/api', backendUrl);
app.use('/api', createProxyMiddleware({
    target: apiUrl.href,
    changeOrigin: true
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});
app.listen(5526, () => {
    console.log('frontend server running at: http://localhost:5526');
});
