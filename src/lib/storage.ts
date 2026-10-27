export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Wraps Web Storage so blocked or throwing storage (private mode, in-app browsers) never breaks the page. */
export function safeStorage(getStore: () => Storage | null | undefined): SafeStorage {
  const store = (): Storage | null => {
    try { return getStore() ?? null; } catch { return null; }
  };
  return {
    get: (k) => { try { return store()?.getItem(k) ?? null; } catch { return null; } },
    set: (k, v) => { try { store()?.setItem(k, v); } catch { /* storage unavailable */ } },
    remove: (k) => { try { store()?.removeItem(k); } catch { /* storage unavailable */ } },
  };
}

export function memoryStorage(): SafeStorage {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } };
}
