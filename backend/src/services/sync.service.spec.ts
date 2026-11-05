import 'reflect-metadata';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource, Repository } from 'typeorm';
import { SyncService } from './sync.service';
import { Space } from '../entities/space.entity';
import { Room } from '../entities/room.entity';
import { Plant } from '../entities/plant.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { WateringLog } from '../entities/watering-log.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';
import { Attachment } from '../entities/attachment.entity';
import { User } from '../entities/user.entity';
import { QuickActionToken } from '../entities/quick-action-token.entity';

describe('SyncService', () => {
  let dataSource: DataSource;
  let syncService: SyncService;
  let spacesRepo: Repository<Space>;
  let roomsRepo: Repository<Room>;
  let plantsRepo: Repository<Plant>;
  let roomPlantsRepo: Repository<RoomPlant>;
  let settingsRepo: Repository<UserSettings>;
  let wateringLogsRepo: Repository<WateringLog>;
  let tombstonesRepo: Repository<SyncTombstone>;

  const testUserId = 'test-user-uuid';

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      entities: [
        User,
        UserSettings,
        Space,
        Room,
        Plant,
        RoomPlant,
        WateringLog,
        QuickActionToken,
        Attachment,
        SyncTombstone,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    spacesRepo = dataSource.getRepository(Space);
    roomsRepo = dataSource.getRepository(Room);
    plantsRepo = dataSource.getRepository(Plant);
    roomPlantsRepo = dataSource.getRepository(RoomPlant);
    settingsRepo = dataSource.getRepository(UserSettings);
    wateringLogsRepo = dataSource.getRepository(WateringLog);
    tombstonesRepo = dataSource.getRepository(SyncTombstone);

    syncService = new SyncService(
      spacesRepo,
      roomsRepo,
      plantsRepo,
      roomPlantsRepo,
      settingsRepo,
      wateringLogsRepo,
      tombstonesRepo,
    );

    await settingsRepo.save(
      settingsRepo.create({
        userId: testUserId,
        preferredMapProvider: 'osm',
        themePreference: 'system',
        emailNotificationsEnabled: true,
        notificationTime: '08:00',
      }),
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('dovrebbe elaborare le modifiche del client inserendo spazi, stanze e piante', async () => {
    const spaceId = 'space-1';
    const roomId = 'room-1';
    const plantId = 'plant-1';
    const rpId = 'rp-1';
    const now = new Date().toISOString();

    const response = await syncService.processSync(testUserId, {
      lastSyncAt: null,
      changes: {
        spaces: [
          {
            id: spaceId,
            name: 'Balcone Sud',
            location: 'Via Roma 10, Milano',
            updatedAt: now,
          },
        ],
        rooms: [
          {
            id: roomId,
            spaceId: spaceId,
            name: 'Fioriera Est',
            updatedAt: now,
          },
        ],
        plants: [
          {
            id: plantId,
            commonName: 'Ficus Benjamina',
            scientificName: 'Ficus benjamina',
            seasonalCare: {
              spring: { watering: { frequencyDays: 4 } },
            },
            updatedAt: now,
          },
        ],
        roomPlants: [
          {
            id: rpId,
            roomId,
            plantId,
            position: 'Angolo soleggiato',
            updatedAt: now,
          },
        ],
      },
    });

    assert.equal(response.status, 'ok');
    assert.ok(response.applied.spaces.includes(spaceId));
    assert.ok(response.applied.rooms.includes(roomId));
    assert.ok(response.applied.plants.includes(plantId));
    assert.ok(response.applied.roomPlants.includes(rpId));

    const savedSpace = await spacesRepo.findOne({ where: { id: spaceId } });
    assert.equal(savedSpace?.name, 'Balcone Sud');

    const savedRoom = await roomsRepo.findOne({ where: { id: roomId } });
    assert.equal(savedRoom?.name, 'Fioriera Est');

    const savedPlant = await plantsRepo.findOne({ where: { id: plantId } });
    assert.equal(savedPlant?.commonName, 'Ficus Benjamina');

    const savedRp = await roomPlantsRepo.findOne({ where: { id: rpId } });
    assert.equal(savedRp?.position, 'Angolo soleggiato');
    assert.ok(savedRp?.nextWateringDueAt);
  });

  it('dovrebbe gestire la cancellazione con generazione di tombstone', async () => {
    const space = await spacesRepo.save(
      spacesRepo.create({
        id: 'space-to-delete',
        userId: testUserId,
        name: 'Spazio temporaneo',
      }),
    );

    const response = await syncService.processSync(testUserId, {
      lastSyncAt: new Date(Date.now() - 10000).toISOString(),
      changes: {
        spaces: [
          {
            id: space.id,
            updatedAt: new Date().toISOString(),
            deleted: true,
          },
        ],
      },
    });

    assert.ok(response.applied.spaces.includes(space.id));
    const checkSpace = await spacesRepo.findOne({ where: { id: space.id } });
    assert.equal(checkSpace, null);

    const tombstone = await tombstonesRepo.findOne({
      where: { entityType: 'space', entityId: space.id },
    });
    assert.ok(tombstone);
  });
});
