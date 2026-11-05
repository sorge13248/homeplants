import { TestBed } from '@angular/core/testing';
import { SyncService } from './sync.service';
import { ApiService } from './api.service';
import { OfflineStorageService } from './offline-storage.service';
import { ToastService } from './toast.service';
import { of, throwError } from 'rxjs';
import { SyncResponseDto } from './models';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('SyncService', () => {
  let service: SyncService;
  let mockApi: {
    sync: ReturnType<typeof vi.fn>;
  };
  let mockToast: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockStorage: {
    getMetadata: ReturnType<typeof vi.fn>;
    setMetadata: ReturnType<typeof vi.fn>;
    getQueue: ReturnType<typeof vi.fn>;
    enqueue: ReturnType<typeof vi.fn>;
    removeQueueItems: ReturnType<typeof vi.fn>;
    saveSpaces: ReturnType<typeof vi.fn>;
    removeSpaces: ReturnType<typeof vi.fn>;
    getAllSpaces: ReturnType<typeof vi.fn>;
    saveRooms: ReturnType<typeof vi.fn>;
    removeRooms: ReturnType<typeof vi.fn>;
    getAllRooms: ReturnType<typeof vi.fn>;
    savePlants: ReturnType<typeof vi.fn>;
    removePlants: ReturnType<typeof vi.fn>;
    getAllPlants: ReturnType<typeof vi.fn>;
    saveRoomPlants: ReturnType<typeof vi.fn>;
    removeRoomPlants: ReturnType<typeof vi.fn>;
    getAllRoomPlants: ReturnType<typeof vi.fn>;
    saveSettings: ReturnType<typeof vi.fn>;
    getSettings: ReturnType<typeof vi.fn>;
  };

  const dummyResponse: SyncResponseDto = {
    serverTime: '2026-11-01T17:00:00.000Z',
    status: 'ok',
    conflicts: [],
    applied: {
      spaces: ['s1'],
      rooms: ['r1'],
      plants: ['p1'],
      roomPlants: ['rp1'],
      settings: true,
      wateringLogs: 1,
    },
    serverChanges: {
      spaces: [],
      deletedSpaceIds: [],
      rooms: [],
      deletedRoomIds: [],
      plants: [],
      deletedPlantIds: [],
      roomPlants: [],
      deletedRoomPlantIds: [],
      settings: null,
    },
  };

  beforeEach(async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApi = {
      sync: vi.fn().mockReturnValue(of(dummyResponse)),
    };

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    mockStorage = {
      getMetadata: vi.fn().mockResolvedValue({
        lastSyncAt: null,
        lastSyncStatus: 'online-ok',
        conflicts: [],
      }),
      setMetadata: vi.fn().mockResolvedValue(undefined),
      getQueue: vi.fn().mockResolvedValue([]),
      enqueue: vi.fn().mockResolvedValue(undefined),
      removeQueueItems: vi.fn().mockResolvedValue(undefined),
      saveSpaces: vi.fn().mockResolvedValue(undefined),
      removeSpaces: vi.fn().mockResolvedValue(undefined),
      getAllSpaces: vi.fn().mockResolvedValue([]),
      saveRooms: vi.fn().mockResolvedValue(undefined),
      removeRooms: vi.fn().mockResolvedValue(undefined),
      getAllRooms: vi.fn().mockResolvedValue([]),
      savePlants: vi.fn().mockResolvedValue(undefined),
      removePlants: vi.fn().mockResolvedValue(undefined),
      getAllPlants: vi.fn().mockResolvedValue([]),
      saveRoomPlants: vi.fn().mockResolvedValue(undefined),
      removeRoomPlants: vi.fn().mockResolvedValue(undefined),
      getAllRoomPlants: vi.fn().mockResolvedValue([]),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue(null),
    };

    TestBed.configureTestingModule({
      providers: [
        SyncService,
        { provide: ApiService, useValue: mockApi },
        { provide: ToastService, useValue: mockToast },
        { provide: OfflineStorageService, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(SyncService);
    await service.init();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('dovrebbe inizializzare e impostare lo stato online-ok quando online e senza conflitti', async () => {
    await service.init();
    expect(service.status()).toBe('online-ok');
    expect(service.isOk()).toBe(true);
    expect(mockToast.success).toHaveBeenCalledWith('Sincronizzazione completata');
  });

  it('dovrebbe eseguire il sync e svuotare la coda al successo', async () => {
    mockStorage.getQueue.mockResolvedValue([
      {
        id: 'q1',
        entityType: 'spaces',
        action: 'update',
        entityId: 's1',
        updatedAt: '2026-11-01T16:30:00.000Z',
        fields: { name: { value: 'Terrazzo', updatedAt: '2026-11-01T16:30:00.000Z' } },
      },
    ]);

    const result = await service.sync();

    expect(mockApi.sync).toHaveBeenCalled();
    expect(result?.status).toBe('ok');
    expect(service.status()).toBe('online-ok');
    expect(mockStorage.removeQueueItems).toHaveBeenCalledWith(['q1']);
  });

  it('non dovrebbe notificare dataUpdated se il sync termina senza modifiche locali o del server', async () => {
    mockStorage.getQueue.mockResolvedValue([]);
    const initialDataUpdated = service.dataUpdated();

    await service.sync();

    expect(service.dataUpdated()).toBe(initialDataUpdated);
  });

  it('dovrebbe impostare lo stato su conflict quando la risposta contiene conflitti', async () => {
    const conflictResponse: SyncResponseDto = {
      ...dummyResponse,
      status: 'conflict',
      conflicts: [
        {
          entityType: 'spaces',
          entityId: 's1',
          field: 'name',
          clientValue: 'A',
          serverValue: 'B',
          clientTimestamp: '2026-11-01T16:00:00.000Z',
          serverTimestamp: '2026-11-01T16:00:00.000Z',
          resolution: 'unresolved',
          message: 'Conflict',
        },
      ],
    };
    mockApi.sync.mockReturnValue(of(conflictResponse));

    await service.sync();

    expect(service.status()).toBe('conflict');
    expect(service.isConflict()).toBe(true);
    expect(service.conflicts().length).toBe(1);
  });

  it('dovrebbe impostare lo stato su offline se il sync fallisce per errore di rete', async () => {
    mockApi.sync.mockReturnValue(throwError(() => new Error('Network error')));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await service.sync();

    expect(service.status()).toBe('offline');
    expect(service.isOffline()).toBe(true);
  });

  it('dovrebbe accodare la modifica di uno spazio con campi formattati', async () => {
    await service.queueSpaceChange('s-100', 'update', { name: 'Giardino', location: 'Roma' });

    expect(mockStorage.enqueue).toHaveBeenCalled();
    const queued = mockStorage.enqueue.mock.calls[0][0];
    expect(queued.entityType).toBe('spaces');
    expect(queued.entityId).toBe('s-100');
    expect(queued.fields?.name?.value).toBe('Giardino');
    expect(queued.fields?.location?.value).toBe('Roma');
    expect(queued.fields?.name?.updatedAt).toBeTruthy();
  });
});
