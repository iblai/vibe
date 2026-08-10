
/**
 * LocalStorageService — implements the StorageService interface required
 * by @iblai/iblai-js/data-layer's initializeDataLayer().
 */

export class LocalStorageService {
  private static instance: LocalStorageService;

  static getInstance(): LocalStorageService {
    if (!this.instance) {
      this.instance = new LocalStorageService();
    }
    return this.instance;
  }

  async getItem<T>(key: string): Promise<T | null> {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key) as T;
  }

  async setItem<T>(key: string, item: T): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, item as unknown as string);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  }
}
