import type { Storage } from '@/storage';

/** Isolated Redis substitute: clone values so tests cannot persist by mutating references. */
export function createTestStorage() {
    const values = new Map<string, unknown>();
    const keyOf = (namespace: string, key: string) => `${namespace}_${key}`;
    const storage = {
        get: jest.fn(async (namespace: string, key: string) => structuredClone(values.get(keyOf(namespace, key)))),
        set: jest.fn(async (namespace: string, key: string, value: unknown) => {
            values.set(keyOf(namespace, key), structuredClone(value));
        }),
        setIfAbsent: jest.fn(async (namespace: string, key: string, value: unknown) => {
            const id = keyOf(namespace, key);
            if (values.has(id)) return false;
            values.set(id, structuredClone(value));
            return true;
        }),
        close: jest.fn(),
    };
    return { storage: storage as unknown as Storage, mocks: storage, values };
}
