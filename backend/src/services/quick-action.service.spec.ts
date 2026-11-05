import 'reflect-metadata';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource, Repository } from 'typeorm';
import { QuickActionService } from './quick-action.service';
import { RoomPlantsService } from './room-plants.service';
import { QuickActionToken } from '../entities/quick-action-token.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { Plant } from '../entities/plant.entity';
import { Room } from '../entities/room.entity';
import { Space } from '../entities/space.entity';
import { WateringLog } from '../entities/watering-log.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';
import { User } from '../entities/user.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { Attachment } from '../entities/attachment.entity';

describe('QuickActionService', () => {
  let dataSource: DataSource;
  let quickActionService: QuickActionService;
  let roomPlantsService: RoomPlantsService;
  let tokenRepo: Repository<QuickActionToken>;
  let roomPlantsRepo: Repository<RoomPlant>;
  let plantsRepo: Repository<Plant>;
  let roomsRepo: Repository<Room>;
  let spacesRepo: Repository<Space>;
  let wateringLogsRepo: Repository<WateringLog>;
  let tombstonesRepo: Repository<SyncTombstone>;

  const testUserId = 'test-user-uuid';
  let createdRoomPlant: RoomPlant;

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

    tokenRepo = dataSource.getRepository(QuickActionToken);
    roomPlantsRepo = dataSource.getRepository(RoomPlant);
    plantsRepo = dataSource.getRepository(Plant);
    roomsRepo = dataSource.getRepository(Room);
    spacesRepo = dataSource.getRepository(Space);
    wateringLogsRepo = dataSource.getRepository(WateringLog);
    tombstonesRepo = dataSource.getRepository(SyncTombstone);

    roomPlantsService = new RoomPlantsService(
      roomPlantsRepo,
      plantsRepo,
      wateringLogsRepo,
      tombstonesRepo,
    );

    quickActionService = new QuickActionService(
      tokenRepo,
      roomPlantsRepo,
      roomPlantsService,
    );

    const space = await spacesRepo.save(
      spacesRepo.create({
        id: 'space-test',
        userId: testUserId,
        name: 'Giardino',
      }),
    );

    const room = await roomsRepo.save(
      roomsRepo.create({
        id: 'room-test',
        userId: testUserId,
        spaceId: space.id,
        name: 'Serra',
      }),
    );

    const plant = await plantsRepo.save(
      plantsRepo.create({
        id: 'plant-test',
        userId: testUserId,
        commonName: 'Pothos',
        seasonalCare: {
          spring: { watering: { frequencyDays: 5 } },
          summer: { watering: { frequencyDays: 3 } },
        },
      }),
    );

    createdRoomPlant = await roomPlantsRepo.save(
      roomPlantsRepo.create({
        id: 'rp-test',
        userId: testUserId,
        roomId: room.id,
        plantId: plant.id,
        position: 'Scaffale alto',
      }),
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('dovrebbe generare un token ed eseguire lazione di innaffiatura', async () => {
    const token = await quickActionService.createToken(testUserId, createdRoomPlant.id, 'water');
    assert.ok(token);
    assert.equal(token.length, 64);

    const result = await quickActionService.executeWater(token);
    assert.equal(result.success, true);
    assert.equal(result.roomPlant.plant?.commonName, 'Pothos');

    const updatedRp = await roomPlantsRepo.findOne({ where: { id: createdRoomPlant.id } });
    assert.ok(updatedRp?.lastWateredAt);

    const logs = await wateringLogsRepo.find({ where: { roomPlantId: createdRoomPlant.id } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].source, 'email-quick-action');

    await assert.rejects(
      async () => quickActionService.executeWater(token),
      /già stata utilizzata/,
    );
  });

  it('dovrebbe posticipare con snooze', async () => {
    const token = await quickActionService.createToken(testUserId, createdRoomPlant.id, 'snooze');

    const result = await quickActionService.executeSnooze(token, 8);
    assert.equal(result.success, true);
    assert.equal(result.hours, 8);

    const updatedRp = await roomPlantsRepo.findOne({ where: { id: createdRoomPlant.id } });
    assert.ok(updatedRp?.snoozedUntil);
    const diffHours = (new Date(updatedRp!.snoozedUntil!).getTime() - Date.now()) / (1000 * 60 * 60);
    assert.equal(Math.round(diffHours), 8);
  });
});
