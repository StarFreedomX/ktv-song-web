const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const dotenv = require('dotenv');

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
