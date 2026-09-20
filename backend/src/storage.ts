import { createClient, RedisClientType } from 'redis';
import ktvLogger from '@/logger';

type LegacyStoredValue<T> = {
    value: T;
    expireAt?: number;
};

export class StorageUnavailableError extends Error {
    constructor(options?: ErrorOptions) {
        super('Redis 未就绪，服务暂不可用，请稍后重试；若持续出现，请联系部署者检查 Redis 连接。', options);
        this.name = 'StorageUnavailableError';
    }
}

export class Storage {
    private client: RedisClientType;
    private redisUrl: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private connecting = false;
    private closed = false;


    constructor(redisUrl?: string) {
        this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = createClient({ url: this.redisUrl, disableOfflineQueue: true, socket:{ reconnectStrategy: false } });

        this.client.on('error', (err) => {
            let msg: string;

            if (err instanceof AggregateError) {
                msg = err.errors
                    .map(e => e.message)
                    .join(' | ');
            } else if (err instanceof Error) {
                msg = err.message;
            } else {
                msg = String(err);
            }
            ktvLogger.error('[Storage]', `Redis error: ${msg}.`);
            ktvLogger.error('[Storage]', 'retry in 5s...');
            this.delayReconnect();
        });

        this.client.on('end', () => {
            ktvLogger.error('[Storage]', 'Redis connection closed');
            this.delayReconnect();
        });

        // 首次连接
        this.connect();
    }

    private async connect() {
        if (this.closed || this.client.isOpen || this.connecting) return;

        this.connecting = true;

        try {
            await this.client.connect();
            const target = new URL(this.redisUrl);
            ktvLogger.info('[Storage]', `Redis ready at ${target.hostname}:${target.port || '6379'}`);
        } catch (err) {
            const target = new URL(this.redisUrl);
            ktvLogger.error('[Storage]', `Redis connection failed at ${target.hostname}:${target.port || '6379'}; check REDIS_URL, Redis availability, network and credentials.`, err instanceof Error ? err.message : err);
            this.delayReconnect();
        } finally {
            this.connecting = false;
        }
    }

    assertReady() {
        // isOpen 只表示 socket 已打开，握手/认证完成后 isReady 才为 true。
        if (!this.client.isReady) throw new StorageUnavailableError();
    }

    private async execute<T>(command: () => Promise<T>): Promise<T> {
        this.assertReady();
        try {
            return await command();
        } catch (cause) {
            throw new StorageUnavailableError({ cause });
        }
    }


    private delayReconnect(delay = 5000) {
        if (this.closed || this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private parseStoredValue<T>(raw: string): { value?: T; expired?: boolean } {
        try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'value' in parsed) {
                const obj = parsed as LegacyStoredValue<T>;
                if (obj.expireAt && Date.now() > obj.expireAt) {
                    return { expired: true };
                }
                return { value: obj.value };
            }
            return { value: parsed as T };
        } catch {
            return {};
        }
    }

    async set<T>(namespace: string, key: string, value: T, ttlMs?: number) {
        this.assertReady();
        const redisKey = `${namespace}_${key}`;
        const payload = JSON.stringify(value);
        if (typeof ttlMs === 'number' && ttlMs > 0) {
            await this.execute(() => this.client.set(redisKey, payload, { PX: ttlMs }));
            return;
        }
        await this.execute(() => this.client.set(redisKey, payload));
    }

    async setIfAbsent<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<boolean> {
        this.assertReady();
        const redisKey = `${namespace}_${key}`;
        const payload = JSON.stringify(value);
        if (typeof ttlMs === 'number' && ttlMs > 0) {
            const result = await this.execute(() => this.client.set(redisKey, payload, { NX: true, PX: ttlMs }));
            return result === 'OK';
        }
        const result = await this.execute(() => this.client.set(redisKey, payload, { NX: true }));
        return result === 'OK';
    }

    async get<T>(namespace: string, key: string): Promise<T | undefined> {
        this.assertReady();
        const redisKey = `${namespace}_${key}`;
        const raw = await this.execute(() => this.client.get(redisKey));
        if (!raw || typeof raw !== 'string') return undefined;

        const { value, expired } = this.parseStoredValue<T>(raw);
        if (expired) {
            await this.execute(() => this.client.del(redisKey));
            return undefined;
        }
        return value;
    }

    async getMany<T>(namespace: string, keys: string[]): Promise<Record<string, T | undefined>> {
        this.assertReady();
        if (!Array.isArray(keys) || keys.length === 0) return {};

        const redisKeys = keys.map(key => `${namespace}_${key}`);
        const rawValues = await this.execute(() => this.client.mGet(redisKeys));
        const results: Record<string, T | undefined> = {};
        const expiredKeys: string[] = [];

        rawValues.forEach((raw, index) => {
            const key = keys[index];
            if (!raw || typeof raw !== 'string') {
                results[key] = undefined;
                return;
            }
            const { value, expired } = this.parseStoredValue<T>(raw);
            if (expired) {
                expiredKeys.push(redisKeys[index]);
                results[key] = undefined;
                return;
            }
            results[key] = value;
        });

        if (expiredKeys.length > 0) {
            await this.execute(() => this.client.unlink(expiredKeys));
        }
        return results;
    }

    async increment(namespace: string, key: string, ttlMs?: number): Promise<number | undefined> {
        this.assertReady();
        const redisKey = `${namespace}_${key}`;

        if (typeof ttlMs === 'number' && ttlMs > 0) {
            const results = await this.execute(() => this.client.multi()
                .incr(redisKey)
                .pExpire(redisKey, ttlMs)
                .exec());
            const value = Array.isArray(results) ? results[0] : undefined;
            return typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : undefined);
        }

        const value = await this.execute(() => this.client.incr(redisKey));
        return typeof value === 'number' ? value : Number(value);
    }

    async remove(namespace: string, key: string) {
        await this.execute(() => this.client.del(`${namespace}_${key}`));
    }

    close() {
        this.closed = true;
        if (this.client.isOpen) {
            this.client.destroy();
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
