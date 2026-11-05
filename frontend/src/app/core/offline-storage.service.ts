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
const DB_VERSION = 1;

const STORE_SPACES = 'spaces';
const STORE_ROOMS = 'rooms';
const STORE_PLANTS = 'plants';
const STORE_ROOM_PLANTS = 'room_plants';
const STORE_SETTINGS = 'settings';
const STORE_ATTACHMENTS = 'offline_attachments';
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
            if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
              db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
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

  // Spaces
  async getAllSpaces(): Promise<SpaceItem[]> {
    const db = await this.getDB();
    if (!db) return Array.from(this.memoryStore.spaces.values());

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SPACES, 'readonly');
        const req = tx.objectStore(STORE_SPACES).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve(Array.from(this.memoryStore.spaces.values()));
      } catch {
        resolve(Array.from(this.memoryStore.spaces.values()));
      }
    });
  }

  async saveSpaces(items: SpaceItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.spaces.set(item.id, item);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SPACES, 'readwrite');
        const store = tx.objectStore(STORE_SPACES);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeSpaces(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.spaces.delete(id);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SPACES, 'readwrite');
        const store = tx.objectStore(STORE_SPACES);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Rooms
  async getAllRooms(): Promise<RoomItem[]> {
    const db = await this.getDB();
    if (!db) return Array.from(this.memoryStore.rooms.values());

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOMS, 'readonly');
        const req = tx.objectStore(STORE_ROOMS).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve(Array.from(this.memoryStore.rooms.values()));
      } catch {
        resolve(Array.from(this.memoryStore.rooms.values()));
      }
    });
  }

  async saveRooms(items: RoomItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.rooms.set(item.id, item);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOMS, 'readwrite');
        const store = tx.objectStore(STORE_ROOMS);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeRooms(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.rooms.delete(id);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOMS, 'readwrite');
        const store = tx.objectStore(STORE_ROOMS);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Plants
  async getAllPlants(): Promise<PlantItem[]> {
    const db = await this.getDB();
    if (!db) return Array.from(this.memoryStore.plants.values());

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLANTS, 'readonly');
        const req = tx.objectStore(STORE_PLANTS).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve(Array.from(this.memoryStore.plants.values()));
      } catch {
        resolve(Array.from(this.memoryStore.plants.values()));
      }
    });
  }

  async savePlants(items: PlantItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.plants.set(item.id, item);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLANTS, 'readwrite');
        const store = tx.objectStore(STORE_PLANTS);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removePlants(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.plants.delete(id);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLANTS, 'readwrite');
        const store = tx.objectStore(STORE_PLANTS);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Room Plants
  async getAllRoomPlants(): Promise<RoomPlantItem[]> {
    const db = await this.getDB();
    if (!db) return Array.from(this.memoryStore.roomPlants.values());

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOM_PLANTS, 'readonly');
        const req = tx.objectStore(STORE_ROOM_PLANTS).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve(Array.from(this.memoryStore.roomPlants.values()));
      } catch {
        resolve(Array.from(this.memoryStore.roomPlants.values()));
      }
    });
  }

  async saveRoomPlants(items: RoomPlantItem[]): Promise<void> {
    for (const item of items) {
      this.memoryStore.roomPlants.set(item.id, item);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOM_PLANTS, 'readwrite');
        const store = tx.objectStore(STORE_ROOM_PLANTS);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeRoomPlants(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryStore.roomPlants.delete(id);
    }
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ROOM_PLANTS, 'readwrite');
        const store = tx.objectStore(STORE_ROOM_PLANTS);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Settings
  async getSettings(): Promise<UserSettings | null> {
    const db = await this.getDB();
    if (!db) return this.memoryStore.settings;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const req = tx.objectStore(STORE_SETTINGS).get('user_settings');
        req.onsuccess = () => resolve(req.result?.data ?? this.memoryStore.settings);
        req.onerror = () => resolve(this.memoryStore.settings);
      } catch {
        resolve(this.memoryStore.settings);
      }
    });
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    this.memoryStore.settings = settings;
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        tx.objectStore(STORE_SETTINGS).put({ key: 'user_settings', data: settings });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Sync Queue
  async getQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    if (!db) return [...this.memoryStore.queue];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const req = tx.objectStore(STORE_QUEUE).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([...this.memoryStore.queue]);
      } catch {
        resolve([...this.memoryStore.queue]);
      }
    });
  }

  async enqueue(item: SyncQueueItem): Promise<void> {
    this.memoryStore.queue.push(item);
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        tx.objectStore(STORE_QUEUE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeQueueItems(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.memoryStore.queue = this.memoryStore.queue.filter((i) => !idSet.has(i.id));
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Metadata
  async getMetadata(): Promise<StorageMetadata> {
    const db = await this.getDB();
    if (!db) return { ...this.memoryStore.meta };

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get('sync_meta');
        req.onsuccess = () => {
          if (req.result) {
            resolve({
              lastSyncAt: req.result.lastSyncAt ?? null,
              lastSyncStatus: req.result.lastSyncStatus ?? 'online-ok',
              conflicts: req.result.conflicts ?? [],
            });
          } else {
            resolve({ ...this.memoryStore.meta });
          }
        };
        req.onerror = () => resolve({ ...this.memoryStore.meta });
      } catch {
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
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async clearAll(): Promise<void> {
    this.memoryStore.spaces.clear();
    this.memoryStore.rooms.clear();
    this.memoryStore.plants.clear();
    this.memoryStore.roomPlants.clear();
    this.memoryStore.queue = [];
    this.memoryStore.settings = null;

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(
          [STORE_SPACES, STORE_ROOMS, STORE_PLANTS, STORE_ROOM_PLANTS, STORE_SETTINGS, STORE_QUEUE],
          'readwrite',
        );
        tx.objectStore(STORE_SPACES).clear();
        tx.objectStore(STORE_ROOMS).clear();
        tx.objectStore(STORE_PLANTS).clear();
        tx.objectStore(STORE_ROOM_PLANTS).clear();
        tx.objectStore(STORE_SETTINGS).clear();
        tx.objectStore(STORE_QUEUE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

