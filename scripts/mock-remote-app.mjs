// Development client for the registration protocol; requires Node.js 22 or newer.
const [baseUrl = 'http://localhost:5526', roomId = 'demo', appId = 'mock-phone',
    name = '模拟投屏 App', targetName = '模拟电视', mode = 'dlna'] = process.argv.slice(2);
const url = new URL('/api/remote/ws', baseUrl);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
url.searchParams.set('roomId', roomId);
const socket = new WebSocket(url);
socket.addEventListener('open', () => socket.send(JSON.stringify({
    v: 1, type: 'register', appId, name, target: { name: targetName, mode },
})));
socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    console.log(data);
    if (data.type === 'error') process.exitCode = 1;
});
socket.addEventListener('close', event => console.log('Disconnected:', event.code, event.reason));
socket.addEventListener('error', () => {
    console.error('WebSocket connection failed:', url.href);
    process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => socket.close(1000, 'Client stopped'));
}
