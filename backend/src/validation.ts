import type { Song } from "@/types";

// 字段上限（写死的常量，不需要环境变量）
export const MAX_SONG_ID_LENGTH = 64;
export const MAX_SONG_TITLE_LENGTH = 100;
export const MAX_SONG_URL_LENGTH = 2048;
export const MAX_NICKNAME_LENGTH = 20;
export const MAX_ROOM_ID_LENGTH = 20;

// 格式：房间号只允许字母/数字/下划线/连字符；歌曲 ID 允许字母/数字/下划线/连字符/点/冒号
export const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const SONG_ID_REGEX = /^[a-zA-Z0-9_:.-]+$/;
const ALLOWED_URL_PREFIXES = ['http://', 'https://', 'bilibili://'];

// 每个校验函数：合法返回 null，非法返回错误消息字符串（供接口直接回给前端）

export function validateRoomId(roomId: unknown): string | null {
    if (typeof roomId !== 'string' || roomId.length === 0) return '无效的房间号';
    if (roomId.length > MAX_ROOM_ID_LENGTH) return `房间号过长（最多 ${MAX_ROOM_ID_LENGTH} 个字符）`;
    if (!ROOM_ID_REGEX.test(roomId)) return '房间号只能包含字母、数字、下划线或连字符';
    return null;
}

export function validateSongId(id: unknown): string | null {
    if (typeof id !== 'string' || id.length === 0) return '歌曲 ID 不能为空';
    if (id.length > MAX_SONG_ID_LENGTH) return `歌曲 ID 过长（最多 ${MAX_SONG_ID_LENGTH} 个字符）`;
    if (!SONG_ID_REGEX.test(id)) return '歌曲 ID 包含非法字符';
    return null;
}

export function validateSongTitle(title: unknown): string | null {
    if (typeof title !== 'string' || title.trim().length === 0) return '歌曲名不能为空';
    if (title.trim().length > MAX_SONG_TITLE_LENGTH) return `歌曲名过长（最多 ${MAX_SONG_TITLE_LENGTH} 个字符）`;
    return null;
}

export function validateSongUrl(url: unknown): string | null {
    if (typeof url !== 'string' || url.trim().length === 0) return '歌曲链接不能为空';
    if (url.trim().length > MAX_SONG_URL_LENGTH) return `歌曲链接过长（最多 ${MAX_SONG_URL_LENGTH} 个字符）`;
    if (!ALLOWED_URL_PREFIXES.some(p => url.trim().startsWith(p))) return '歌曲链接仅支持 http/https/bilibili 协议';
    return null;
}

// 链接归一化：已带白名单协议原样返回；纯 BV/av 号转成 B 站视频链接；其余前置 https://（中和自定义协议）
export function normalizeSongUrl(url: string): string {
    const trimmed = url.trim();
    if (ALLOWED_URL_PREFIXES.some(p => trimmed.startsWith(p))) return trimmed;
    const bvMatch = trimmed.match(/^BV[a-zA-Z0-9]{10}$/i);
    if (bvMatch) return `https://www.bilibili.com/video/${bvMatch[0]}`;
    const avMatch = trimmed.match(/^av\d+$/i);
    if (avMatch) return `https://www.bilibili.com/video/${avMatch[0]}`;
    return `https://${trimmed}`;
}

export function validateAddedBy(addedBy: unknown): string | null {
    if (addedBy === undefined || addedBy === null) return null; // 可选字段
    if (typeof addedBy !== 'string') return '点歌人昵称必须是字符串';
    if (addedBy.trim().length > MAX_NICKNAME_LENGTH) return `点歌人昵称过长（最多 ${MAX_NICKNAME_LENGTH} 个字符）`;
    return null;
}

// 聚合校验整首歌（返回最先发现的错误）
export function validateSong(song: unknown): string | null {
    if (!song || typeof song !== 'object' || Array.isArray(song)) return '无效的歌曲信息';
    const s = song as Partial<Song>;
    return validateSongId(s.id) ?? validateSongTitle(s.title) ?? validateSongUrl(s.url) ?? validateAddedBy(s.addedBy);
}
