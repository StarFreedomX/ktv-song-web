// Development client for the remote-control protocol; requires Node.js 22 or newer.
const [baseUrl = 'http://localhost:5526', roomId = 'demo', appId = 'mock-phone',
    name = '模拟投屏 App', targetName = '模拟电视', mode = 'dlna'] = process.argv.slice(2);

const url = new URL('/api/ws', baseUrl);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
url.searchParams.set('roomId', roomId);

const DURATION = 240;

const socket = new WebSocket(url);
console.log('Connecting:', url.href);

let seq = 0;
let position = 0;
let volume = 40;
let isPlaying = true;
let qualities = [
    { qn: 80, format: 'dash', label: '1080P高清', now: true },
    { qn: 64, format: 'dash', label: '720P准高清' },
];
let timer = null;

// 5 秒一次的状态采样，位置按 elapsed 推进。
function reportState() {
    if (isPlaying) position = (position + 5) % DURATION;
    seq += 1;
    socket.send(JSON.stringify({
        v: 1,
        type: 'remote:playback',
        playback: {
            seq, position, duration: DURATION, volume, isPlaying, qualities,
            capabilities: { absoluteVolume: true, seek: true, quality: true },
        },
    }));
}

// 收到的命令直接作用在模拟的播放状态上，下一次采样即可看到结果。
function applyCommand({ command, payload = {} }) {
    switch (command) {
        case 'play': isPlaying = true; break;
        case 'pause': isPlaying = false; break;
        case 'seek': position = Math.max(0, Math.min(DURATION, Number(payload.seconds) || 0)); break;
        case 'setVolume': volume = payload.volume; break;
        case 'changeVolume': volume = Math.max(0, Math.min(100, volume + (payload.increase ? 5 : -5))); break;
        case 'setQuality': qualities = qualities.map(item => ({ ...item, now: item.qn === payload.qn })); break;
        case 'recast': position = 0; isPlaying = true; break;
    }
}

socket.addEventListener('open', () => socket.send(JSON.stringify({
    v: 1, type: 'remote:register', appId, name, target: { name: targetName, mode },
})));

socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.type === 'remote:registered') {
        console.log('Registered:', data.appId, data.sessionId);
        if (!timer) {
            reportState();
            timer = setInterval(reportState, 5000);
        }
        return;
    }
    if (data.type === 'remote:command') {
        console.log('Command:', data.command, JSON.stringify(data.payload ?? {}));
        applyCommand(data);
        return;
    }
    if (data.type === 'remote:error') {
        console.error('Error:', data.code, data.msg);
        process.exitCode = 1;
        return;
    }
    // 歌单同步与设备列表通知与本客户端无关。
    if (data.type === 'pong' || data.type === 'UPDATE' || data.type === 'remote:apps' || data.type === 'remote:state') return;
    console.log(data);
});

socket.addEventListener('close', event => {
    clearInterval(timer);
    console.log('Disconnected:', event.code, event.reason);
});
socket.addEventListener('error', () => {
    console.error('WebSocket connection failed:', url.href);
    process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => socket.close(1000, 'Client stopped'));
}
