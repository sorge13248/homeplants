import { Injectable } from '@angular/core';
import {
  PlantItem,
  RoomItem,
  RoomPlantItem,
  SpaceItem,
  SyncConflict,
  SyncQueueItem,
  SyncStatus,
  UserSettings,
} from './models';

const DB_NAME = 'homeplants_offline_v1';
const DB_VERSION = 2;

const STORE_SPACES = 'spaces';
const STORE_ROOMS = 'rooms';
const STORE_PLANTS = 'plants';
const STORE_ROOM_PLANTS = 'room_plants';
const STORE_SETTINGS = 'settings';
const STORE_QUEUE = 'sync_queue';
const STORE_META = 'meta';

export interface StorageMetadata {
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus;
  conflicts: SyncConflict[];
}

@Injectable({ providedIn: 'root' })
export class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memoryStore = {
    spaces: new Map<string, SpaceItem>(),
    rooms: new Map<string, RoomItem>(),
    plants: new Map<string, PlantItem>(),
    roomPlants: new Map<string, RoomPlantItem>(),
    settings: null as UserSettings | null,
    queue: [] as SyncQueueItem[],
    meta: {
      lastSyncAt: null as string | null,
      lastSyncStatus: 'online-ok' as SyncStatus,
      conflicts: [] as SyncConflict[],
    },
  };

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_SPACES)) {
              db.createObjectStore(STORE_SPACES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_ROOMS)) {
              const store = db.createObjectStore(STORE_ROOMS, { keyPath: 'id' });
              store.createIndex('spaceId', 'spaceId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_PLANTS)) {
              db.createObjectStore(STORE_PLANTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_ROOM_PLANTS)) {
              const store = db.createObjectStore(STORE_ROOM_PLANTS, { keyPath: 'id' });
              store.createIndex('roomId', 'roomId', { unique: false });
              store.createIndex('plantId', 'plantId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
              db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_QUEUE)) {
              db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
              db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  // ==========================================
  // COMMON HELPERS
  // ==========================================
  private sortByName<T extends { name?: string }>(list: T[]): T[] {
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  private sortByCommonName<T extends { commonName?: string }>(list: T[]): T[] {
    return [...list].sort((a, b) => (a.commonName || '').localeCompare(b.commonName || ''));
  }

  private async executeGetAll<T extends { id: string }>(
    storeName: string,
    memoryMap: Map<string, T>,
  ): Promise<T[]> {
    const db = await this.getDB();
    if (!db) return Array.from(memoryMap.values());

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => {
          const list: T[] = req.result ?? [];
          for (const item of list) {
            memoryMap.set(item.id, item);
          }
          resolve(list);
        };
        req.onerror = () => {
          console.warn(`[OfflineStorage] Error reading all from ${storeName}:`, req.error);
          resolve(Array.from(memoryMap.values()));
        };
      } catch (err) {
        console.warn(`[OfflineStorage] Failed executeGetAll on ${storeName}:`, err);
        resolve(Array.from(memoryMap.values()));
      }
    });
  }

  private async executeGet<T>(
    storeName: string,
    id: string,
    fallback: T | null,
    onSuccessHydrate?: (item: T) => void,
  ): Promise<T | null> {
    const db = await this.getDB();
    if (!db) return fallback;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(id);
        req.onsuccess = () => {
          const result = (req.result as T) ?? null;
          if (result && onSuccessHydrate) {
            onSuccessHydrate(result);
          }
          resolve(result ?? fallback);
        };
        req.onerror = () => {
          console.warn(`[OfflineStorage] Error reading key ${id} from ${storeName}:`, req.error);
          resolve(fallback);
        };
      } catch (err) {
        console.warn(`[OfflineStorage] Failed executeGet on ${storeName}:`, err);
        resolve(fallback);
      }
    });
  }

  private async executePut<T>(storeName: string, items: T[]): Promise<void> {
    if (!items.length) return;
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn(`[OfflineStorage] Error putting into ${storeName}:`, tx.error);
          resolve();
        };
      } catch (err) {
        console.warn(`[OfflineStorage] Failed executePut on ${storeName}:`, err);
        resolve();
      }
    });
  }

  private async executeDelete(storeName: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn(`[OfflineStorage] Error deleting from ${storeName}:`, tx.error);
          resolve();
        };
      } catch (err) {
        console.warn(`[OfflineStorage] Failed executeDelete on ${storeName}:`, err);
        resolve();
      }
    });
  }

  private async executeClear(storeName: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn(`[OfflineStorage] Error clearing ${storeName}:`, tx.error);
          resolve();
        };
      } catch (err) {
        console.warn(`[OfflineStorage] Failed executeClear on ${storeName}:`, err);
        resolve();
      }
    });
  }

  // ==========================================
  // SPACES
  // ==========================================
  async getAllSpaces(): Promise<SpaceItem[]> {
    const list = await this.executeGetAll(STORE_SPACES, this.memoryStore.spaces);
    return this.sortByName(list);
  }

  async getSpace(id: string): Promise<SpaceItem | null> {
    return this.executeGet(
      STORE_SPACES,
      id,
      this.memoryStore.spaces.get(id) ?? null,
      (item) => this.memoryStore.spaces.set(item.id, item),
    );
  }

  async saveSpaces(items: SpaceItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.spaces.set(item.id, item);
    }
    await this.executePut(STORE_SPACES, items);
  }

  async removeSpaces(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.spaces.delete(id);
    }
    await this.executeDelete(STORE_SPACES, ids);
  }

  async clearSpaces(): Promise<void> {
    this.memoryStore.spaces.clear();
    await this.executeClear(STORE_SPACES);
  }

  // ==========================================
  // ROOMS
  // ==========================================
  async getAllRooms(): Promise<RoomItem[]> {
    const list = await this.executeGetAll(STORE_ROOMS, this.memoryStore.rooms);
    return this.sortByName(list);
  }

  async getRoom(id: string): Promise<RoomItem | null> {
    return this.executeGet(
      STORE_ROOMS,
      id,
      this.memoryStore.rooms.get(id) ?? null,
      (item) => this.memoryStore.rooms.set(item.id, item),
    );
  }

  async getRoomsBySpace(spaceId: string): Promise<RoomItem[]> {
    const rooms = await this.getAllRooms();
    return rooms.filter((r) => r.spaceId === spaceId);
  }

  async saveRooms(items: RoomItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.rooms.set(item.id, item);
    }
    await this.executePut(STORE_ROOMS, items);
  }

  async removeRooms(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.rooms.delete(id);
    }
    await this.executeDelete(STORE_ROOMS, ids);
  }

  async clearRooms(): Promise<void> {
    this.memoryStore.rooms.clear();
    await this.executeClear(STORE_ROOMS);
  }

  // ==========================================
  // PLANTS
  // ==========================================
  async getAllPlants(): Promise<PlantItem[]> {
    const list = await this.executeGetAll(STORE_PLANTS, this.memoryStore.plants);
    return this.sortByCommonName(list);
  }

  async getPlant(id: string): Promise<PlantItem | null> {
    return this.executeGet(
      STORE_PLANTS,
      id,
      this.memoryStore.plants.get(id) ?? null,
      (item) => this.memoryStore.plants.set(item.id, item),
    );
  }

  async savePlants(items: PlantItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.plants.set(item.id, item);
    }
    await this.executePut(STORE_PLANTS, items);
  }

  async removePlants(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.plants.delete(id);
    }
    await this.executeDelete(STORE_PLANTS, ids);
  }

  async clearPlants(): Promise<void> {
    this.memoryStore.plants.clear();
    await this.executeClear(STORE_PLANTS);
  }

  // ==========================================
  // ROOM PLANTS
  // ==========================================
  async getAllRoomPlants(): Promise<RoomPlantItem[]> {
    return this.executeGetAll(STORE_ROOM_PLANTS, this.memoryStore.roomPlants);
  }

  async getRoomPlant(id: string): Promise<RoomPlantItem | null> {
    return this.executeGet(
      STORE_ROOM_PLANTS,
      id,
      this.memoryStore.roomPlants.get(id) ?? null,
      (item) => this.memoryStore.roomPlants.set(item.id, item),
    );
  }

  async getRoomPlantsByRoom(roomId: string): Promise<RoomPlantItem[]> {
    const list = await this.getAllRoomPlants();
    return list.filter((rp) => rp.roomId === roomId);
  }

  async getRoomPlantsByPlant(plantId: string): Promise<RoomPlantItem[]> {
    const list = await this.getAllRoomPlants();
    return list.filter((rp) => rp.plantId === plantId);
  }

  async saveRoomPlants(items: RoomPlantItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.roomPlants.set(item.id, item);
    }
    await this.executePut(STORE_ROOM_PLANTS, items);
  }

  async removeRoomPlants(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.roomPlants.delete(id);
    }
    await this.executeDelete(STORE_ROOM_PLANTS, ids);
  }

  async clearRoomPlants(): Promise<void> {
    this.memoryStore.roomPlants.clear();
    await this.executeClear(STORE_ROOM_PLANTS);
  }

  // ==========================================
  // SETTINGS
  // ==========================================
  async getSettings(): Promise<UserSettings | null> {
    const db = await this.getDB();
    if (!db) return this.memoryStore.settings;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const req = tx.objectStore(STORE_SETTINGS).get('user_settings');
        req.onsuccess = () => {
          const settings = req.result?.data ?? this.memoryStore.settings;
          if (settings) {
            this.memoryStore.settings = settings;
          }
          resolve(settings);
        };
        req.onerror = () => {
          console.warn('[OfflineStorage] Error reading settings:', req.error);
          resolve(this.memoryStore.settings);
        };
      } catch (err) {
        console.warn('[OfflineStorage] Failed getSettings:', err);
        resolve(this.memoryStore.settings);
      }
    });
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    this.memoryStore.settings = settings;
    await this.executePut(STORE_SETTINGS, [{ key: 'user_settings', data: settings }]);
  }

  // ==========================================
  // SYNC QUEUE
  // ==========================================
  async getQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    if (!db) return [...this.memoryStore.queue];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const req = tx.objectStore(STORE_QUEUE).getAll();
        req.onsuccess = () => {
          const result: SyncQueueItem[] = req.result ?? [];
          this.memoryStore.queue = [...result];
          resolve(result);
        };
        req.onerror = () => {
          console.warn('[OfflineStorage] Error reading queue:', req.error);
          resolve([...this.memoryStore.queue]);
        };
      } catch (err) {
        console.warn('[OfflineStorage] Failed getQueue:', err);
        resolve([...this.memoryStore.queue]);
      }
    });
  }

  async enqueue(item: SyncQueueItem): Promise<void> {
    this.memoryStore.queue.push(item);
    await this.executePut(STORE_QUEUE, [item]);
  }

  async enqueueBatch(items: SyncQueueItem[]): Promise<void> {
    if (!items.length) return;
    this.memoryStore.queue.push(...items);
    await this.executePut(STORE_QUEUE, items);
  }

  async removeQueueItems(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.memoryStore.queue = this.memoryStore.queue.filter((i) => !idSet.has(i.id));
    await this.executeDelete(STORE_QUEUE, ids);
  }

  async clearQueue(): Promise<void> {
    this.memoryStore.queue = [];
    await this.executeClear(STORE_QUEUE);
  }

  // ==========================================
  // METADATA
  // ==========================================
  async getMetadata(): Promise<StorageMetadata> {
    const db = await this.getDB();
    if (!db) return { ...this.memoryStore.meta };

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get('sync_meta');
        req.onsuccess = () => {
          if (req.result) {
            const meta: StorageMetadata = {
              lastSyncAt: req.result.lastSyncAt ?? null,
              lastSyncStatus: req.result.lastSyncStatus ?? 'online-ok',
              conflicts: req.result.conflicts ?? [],
            };
            this.memoryStore.meta = { ...meta };
            resolve(meta);
          } else {
            resolve({ ...this.memoryStore.meta });
          }
        };
        req.onerror = () => {
          console.warn('[OfflineStorage] Error reading metadata:', req.error);
          resolve({ ...this.memoryStore.meta });
        };
      } catch (err) {
        console.warn('[OfflineStorage] Failed getMetadata:', err);
        resolve({ ...this.memoryStore.meta });
      }
    });
  }

  async setMetadata(data: Partial<StorageMetadata>): Promise<void> {
    this.memoryStore.meta = { ...this.memoryStore.meta, ...data };
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({
          key: 'sync_meta',
          ...this.memoryStore.meta,
          ...data,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[OfflineStorage] Error saving metadata:', tx.error);
          resolve();
        };
      } catch (err) {
        console.warn('[OfflineStorage] Failed setMetadata:', err);
        resolve();
      }
    });
  }

  // ==========================================
  // RESET ALL
  // ==========================================
  async clearAll(): Promise<void> {
    this.memoryStore.spaces.clear();
    this.memoryStore.rooms.clear();
    this.memoryStore.plants.clear();
    this.memoryStore.roomPlants.clear();
    this.memoryStore.queue = [];
    this.memoryStore.settings = null;
    this.memoryStore.meta = {
      lastSyncAt: null,
      lastSyncStatus: 'online-ok',
      conflicts: [],
    };

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(
          [STORE_SPACES, STORE_ROOMS, STORE_PLANTS, STORE_ROOM_PLANTS, STORE_SETTINGS, STORE_QUEUE, STORE_META],
          'readwrite',
        );
        tx.objectStore(STORE_SPACES).clear();
        tx.objectStore(STORE_ROOMS).clear();
        tx.objectStore(STORE_PLANTS).clear();
        tx.objectStore(STORE_ROOM_PLANTS).clear();
        tx.objectStore(STORE_SETTINGS).clear();
        tx.objectStore(STORE_QUEUE).clear();
        tx.objectStore(STORE_META).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[OfflineStorage] Error clearing all stores:', tx.error);
          resolve();
        };
      } catch (err) {
        console.warn('[OfflineStorage] Failed clearAll:', err);
        resolve();
      }
    });
  }
}
