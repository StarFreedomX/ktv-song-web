const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const app = express();

app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5823/api',
    changeOrigin: true
}));

app.use('/static', createProxyMiddleware({
    target: 'http://localhost:5823/static',
    changeOrigin: true
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});
app.listen(5526, () => {
    console.log('frontend server running at: http://localhost:5526');
});
