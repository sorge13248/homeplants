import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OfflineStorageService } from './offline-storage.service';
import { SpaceItem, RoomItem, PlantItem, UserSettings, SyncQueueItem } from './models';

describe('OfflineStorageService', () => {
  let service: OfflineStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OfflineStorageService],
    });
    service = TestBed.inject(OfflineStorageService);
  });

  it('dovrebbe essere istanziato correttamente', () => {
    expect(service).toBeTruthy();
  });

  it('dovrebbe salvare e recuperare gli spazi', async () => {
    const space: SpaceItem = {
      id: 'space-1',
      name: 'Balcone Sud',
      location: 'Milano',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await service.saveSpaces([space]);
    const retrieved = await service.getSpace('space-1');
    expect(retrieved).toEqual(space);

    const all = await service.getAllSpaces();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Balcone Sud');

    await service.removeSpaces(['space-1']);
    const afterDelete = await service.getSpace('space-1');
    expect(afterDelete).toBeNull();
  });

  it('dovrebbe salvare e recuperare stanze per spazio', async () => {
    const room: RoomItem = {
      id: 'room-1',
      spaceId: 'space-1',
      name: 'Fioriere Ringhiera',
      description: 'Esposte al sole',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await service.saveRooms([room]);
    const bySpace = await service.getRoomsBySpace('space-1');
    expect(bySpace.length).toBe(1);
    expect(bySpace[0].name).toBe('Fioriere Ringhiera');

    const single = await service.getRoom('room-1');
    expect(single).toEqual(room);
  });

  it('dovrebbe salvare e recuperare piante botaniche', async () => {
    const plant: PlantItem = {
      id: 'plant-1',
      commonName: 'Ficus Elastica',
      scientificName: 'Ficus elastica Roxb.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await service.savePlants([plant]);
    const single = await service.getPlant('plant-1');
    expect(single?.commonName).toBe('Ficus Elastica');

    const all = await service.getAllPlants();
    expect(all.some((p: PlantItem) => p.id === 'plant-1')).toBe(true);
  });

  it('dovrebbe ordinare spazi, stanze e piante in ordine alfabetico', async () => {
    // Spazi
    await service.saveSpaces([
      { id: 's-z', name: 'Z - Terrazzo', createdAt: '', updatedAt: '' },
      { id: 's-a', name: 'A - Balcone', createdAt: '', updatedAt: '' },
      { id: 's-m', name: 'M - Salotto', createdAt: '', updatedAt: '' },
    ]);
    const spaces = await service.getAllSpaces();
    expect(spaces.map((s) => s.name)).toEqual(['A - Balcone', 'M - Salotto', 'Z - Terrazzo']);

    // Stanze
    await service.saveRooms([
      { id: 'r-z', spaceId: 's-a', name: 'Zona Z', createdAt: '', updatedAt: '' },
      { id: 'r-a', spaceId: 's-a', name: 'Angolo A', createdAt: '', updatedAt: '' },
      { id: 'r-m', spaceId: 's-a', name: 'Mensola M', createdAt: '', updatedAt: '' },
    ]);
    const roomsBySpace = await service.getRoomsBySpace('s-a');
    expect(roomsBySpace.map((r) => r.name)).toEqual(['Angolo A', 'Mensola M', 'Zona Z']);

    const allRooms = await service.getAllRooms();
    expect(allRooms.map((r) => r.name)).toEqual(['Angolo A', 'Mensola M', 'Zona Z']);

    // Piante
    await service.savePlants([
      { id: 'p-z', commonName: 'Zamioculcas', createdAt: '', updatedAt: '' },
      { id: 'p-a', commonName: 'Aloe Vera', createdAt: '', updatedAt: '' },
      { id: 'p-m', commonName: 'Monstera Deliciosa', createdAt: '', updatedAt: '' },
    ]);
    const plants = await service.getAllPlants();
    expect(plants.map((p) => p.commonName)).toEqual(['Aloe Vera', 'Monstera Deliciosa', 'Zamioculcas']);
  });

  it('dovrebbe gestire la coda di sincronizzazione', async () => {
    const item: SyncQueueItem = {
      id: 'queue-1',
      entityType: 'spaces',
      action: 'create',
      entityId: 'space-123',
      updatedAt: new Date().toISOString(),
      data: { name: 'Giardino' },
    };

    await service.enqueue(item);
    const queue = await service.getQueue();
    expect(queue.some((q) => q.id === 'queue-1')).toBe(true);

    await service.removeQueueItems(['queue-1']);
    const queueAfter = await service.getQueue();
    expect(queueAfter.some((q) => q.id === 'queue-1')).toBe(false);
  });

  it('dovrebbe salvare e recuperare le impostazioni utente', async () => {
    const settings: UserSettings = {
      preferredMapProvider: 'google',
      themePreference: 'dark',
      emailNotificationsEnabled: false,
      notificationTime: '09:00',
    };

    await service.saveSettings(settings);
    const retrieved = await service.getSettings();
    expect(retrieved?.preferredMapProvider).toBe('google');
    expect(retrieved?.themePreference).toBe('dark');
  });

  it('dovrebbe salvare e recuperare i metadati di sincronizzazione', async () => {
    await service.setMetadata({
      lastSyncAt: '2026-11-05T12:00:00.000Z',
      lastSyncStatus: 'online-ok',
    });

    const meta = await service.getMetadata();
    expect(meta?.lastSyncAt).toBe('2026-11-05T12:00:00.000Z');
    expect(meta?.lastSyncStatus).toBe('online-ok');
  });
});
