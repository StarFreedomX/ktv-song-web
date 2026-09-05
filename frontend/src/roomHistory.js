const KEY = 'ktv_room_history';
export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function readRoomHistory() {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(rows)) throw new Error('历史房间记录格式异常');
    return rows.filter(row => row && isUuid(row.uuid));
}

export function rememberRoom(room) {
    if (!isUuid(room.uuid)) return;
    const uuid = room.uuid.toLowerCase();
    const rows = readRoomHistory();
    const previous = rows.find(row => row.uuid === uuid);
    localStorage.setItem(KEY, JSON.stringify([
        { ...previous, ...room, uuid, savedAt: Date.now() },
        ...rows.filter(row => row.uuid !== uuid)
    ]));
}

export async function fetchArchive(uuid) {
    const res = await fetch(`/api/roomArchive?uuid=${encodeURIComponent(uuid)}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.msg || '读取房间失败，请稍后重试');
    return data;
}

export const formatDate = value => value ? new Date(value).toLocaleString('zh-CN') : '未知';
