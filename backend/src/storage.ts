import { createClient, RedisClientType } from 'redis';
import ktvLogger from '@/logger';

interface StoredValue<T> {
    value: T;
    expireAt?: number;
}

export class Storage {
    private client: RedisClientType;
    private redisUrl: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private connecting = false;


    constructor(redisUrl?: string) {
        this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = createClient({ url: this.redisUrl, socket:{ reconnectStrategy: false } });

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
        if (this.client.isOpen || this.connecting) return;

        this.connecting = true;

        try {
            await this.client.connect();
            ktvLogger.info('[Storage]', `Redis connected at ${this.redisUrl}`);
        } catch (err) {
        } finally {
            this.connecting = false;
        }
    }


    private delayReconnect(delay = 5000) {
        if (this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    async set<T>(namespace: string, key: string, value: T, ttlMs?: number) {
        if (!this.client.isOpen) return;

        const obj: StoredValue<T> = ttlMs
            ? { value, expireAt: Date.now() + ttlMs }
            : { value };

        await this.client.set(`${namespace}_${key}`, JSON.stringify(obj));
    }

    async get<T>(namespace: string, key: string): Promise<T | undefined> {
        if (!this.client.isOpen) return undefined;

        const raw = await this.client.get(`${namespace}_${key}`);
        if (!raw || typeof raw !== 'string') return undefined;

        try {
            const obj: StoredValue<T> = JSON.parse(raw);
            if (obj.expireAt && Date.now() > obj.expireAt) {
                await this.client.del(`${namespace}_${key}`);
                return undefined;
            }
            return obj.value;
        } catch {
            return undefined;
        }
    }

    async remove(namespace: string, key: string) {
        if (!this.client.isOpen) return;
        await this.client.del(`${namespace}_${key}`);
    }
}
