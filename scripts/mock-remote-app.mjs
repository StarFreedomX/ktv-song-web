// Development client for the remote-control protocol; requires Node.js 22 or newer.
const [baseUrl = 'http://localhost:5526', roomId = 'demo', appId = 'mock-phone',
    name = '模拟投屏 App', targetName = '模拟电视', mode = 'dlna'] = process.argv.slice(2);

const url = new URL('/api/ws', baseUrl);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
url.searchParams.set('roomId', roomId);

const socket = new WebSocket(url);
console.log('Connecting:', url.href);

socket.addEventListener('open', () => socket.send(JSON.stringify({
    v: 1, type: 'remote:register', appId, name, target: { name: targetName, mode },
})));

socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.type === 'remote:registered') {
        console.log('Registered:', data.appId, data.sessionId);
        return;
    }
    if (data.type === 'remote:error') {
        console.error('Register failed:', data.code, data.msg);
        process.exitCode = 1;
        return;
    }
    // 歌单同步与设备列表通知与本客户端无关。
    if (data.type === 'pong' || data.type === 'UPDATE' || data.type === 'remote:apps') return;
    console.log(data);
});

socket.addEventListener('close', event => console.log('Disconnected:', event.code, event.reason));
socket.addEventListener('error', () => {
    console.error('WebSocket connection failed:', url.href);
    process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => socket.close(1000, 'Client stopped'));
}
