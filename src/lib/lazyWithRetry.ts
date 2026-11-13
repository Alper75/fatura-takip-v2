import { lazy, type ComponentType } from 'react';

const RELOAD_STORAGE_KEY = 'fatura_app_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|ChunkLoadError/i.test(
    msg
  );
}

export function triggerSafeChunkReload(): boolean {
  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_STORAGE_KEY) || '0');
    const now = Date.now();
    if (!lastReload || now - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    window.location.reload();
    return true;
  }
  return false;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error) && triggerSafeChunkReload()) {
        // Sayfa yenilenene kadar beklemede kal (hata ekranı göstermeden)
        return await new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
