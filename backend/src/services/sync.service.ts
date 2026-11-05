import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Space } from '../entities/space.entity';
import { Room } from '../entities/room.entity';
import { Plant } from '../entities/plant.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { WateringLog } from '../entities/watering-log.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';
import { SyncPayloadDto, SyncResponseDto, SyncConflict } from '../common/sync/sync.types';
import { computeNextWateringDate, getWateringFrequencyDays } from './room-plants.service';

function extractValue<T = any>(item: any, key: string, fallback?: T): T | undefined {
  if (!item) return fallback;
  if (item[key] !== undefined) return item[key];
  if (item.data && item.data[key] !== undefined) return item.data[key];
  if (item.fields && item.fields[key] !== undefined) {
    const f = item.fields[key];
    return f && typeof f === 'object' && 'value' in f ? f.value : f;
  }
  return fallback;
}

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
    @InjectRepository(Plant)
    private readonly plantsRepo: Repository<Plant>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    @InjectRepository(WateringLog)
    private readonly wateringLogsRepo: Repository<WateringLog>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {}

  async processSync(userId: string, payload: SyncPayloadDto): Promise<SyncResponseDto> {
    const serverTime = new Date().toISOString();
    const lastSyncDate = payload.lastSyncAt ? new Date(payload.lastSyncAt) : null;

    const applied = {
      spaces: [] as string[],
      rooms: [] as string[],
      plants: [] as string[],
      roomPlants: [] as string[],
      settings: false,
      wateringLogs: 0,
    };
    const conflicts: SyncConflict[] = [];

    // 1. Process client changes
    const changes = payload.changes ?? {};

    // 1.1 Spaces
    if (changes.spaces?.length) {
      for (const item of changes.spaces) {
        if (item.deleted) {
          await this.deleteSpaceWithTombstone(userId, item.id);
          applied.spaces.push(item.id);
        } else {
          let space = await this.spacesRepo.findOne({ where: { id: item.id, userId } });
          const clientUpdated = new Date(item.updatedAt);
          const name = extractValue(item, 'name', 'Nuovo Spazio')!;
          const location = extractValue(item, 'location', null);
          const description = extractValue(item, 'description', null);
          const coverPhotoUrl = extractValue(item, 'coverPhotoUrl', null);

          if (!space) {
            space = this.spacesRepo.create({
              id: item.id,
              userId,
              name,
              location,
              description,
              coverPhotoUrl,
            });
            space.createdAt = clientUpdated;
            space.updatedAt = clientUpdated;
            await this.spacesRepo.save(space);
            applied.spaces.push(space.id);
          } else if (clientUpdated >= space.updatedAt) {
            if (name !== undefined) space.name = name;
            if (location !== undefined) space.location = location;
            if (description !== undefined) space.description = description;
            if (coverPhotoUrl !== undefined) space.coverPhotoUrl = coverPhotoUrl;
            space.updatedAt = clientUpdated;
            await this.spacesRepo.save(space);
            applied.spaces.push(space.id);
          }
        }
      }
    }

    // 1.2 Rooms
    if (changes.rooms?.length) {
      for (const item of changes.rooms) {
        if (item.deleted) {
          await this.deleteRoomWithTombstone(userId, item.id);
          applied.rooms.push(item.id);
        } else {
          let room = await this.roomsRepo.findOne({ where: { id: item.id, userId } });
          const clientUpdated = new Date(item.updatedAt);
          const spaceId = extractValue(item, 'spaceId');
          const name = extractValue(item, 'name', 'Nuova Stanza')!;
          const description = extractValue(item, 'description', null);
          const coverPhotoUrl = extractValue(item, 'coverPhotoUrl', null);

          if (!room) {
            room = this.roomsRepo.create({
              id: item.id,
              userId,
              spaceId: spaceId!,
              name,
              description,
              coverPhotoUrl,
            });
            room.createdAt = clientUpdated;
            room.updatedAt = clientUpdated;
            await this.roomsRepo.save(room);
            applied.rooms.push(room.id);
          } else if (clientUpdated >= room.updatedAt) {
            if (name !== undefined) room.name = name;
            if (description !== undefined) room.description = description;
            if (coverPhotoUrl !== undefined) room.coverPhotoUrl = coverPhotoUrl;
            if (spaceId !== undefined) room.spaceId = spaceId;
            room.updatedAt = clientUpdated;
            await this.roomsRepo.save(room);
            applied.rooms.push(room.id);
          }
        }
      }
    }

    // 1.3 Plants
    if (changes.plants?.length) {
      for (const item of changes.plants) {
        if (item.deleted) {
          await this.deletePlantWithTombstone(userId, item.id);
          applied.plants.push(item.id);
        } else {
          let plant = await this.plantsRepo.findOne({ where: { id: item.id, userId } });
          const clientUpdated = new Date(item.updatedAt);
          const commonName = extractValue(item, 'commonName', 'Nuova Pianta')!;
          const scientificName = extractValue(item, 'scientificName', null);
          const seasonalCare = extractValue(item, 'seasonalCare', null);
          const soilRepotting = extractValue(item, 'soilRepotting', null);
          const fertilization = extractValue(item, 'fertilization', null);

          if (!plant) {
            plant = this.plantsRepo.create({
              id: item.id,
              userId,
              commonName,
              scientificName,
              seasonalCare,
              soilRepotting,
              fertilization,
            });
            plant.createdAt = clientUpdated;
            plant.updatedAt = clientUpdated;
            await this.plantsRepo.save(plant);
            applied.plants.push(plant.id);
          } else if (clientUpdated >= plant.updatedAt) {
            if (commonName !== undefined) plant.commonName = commonName;
            if (scientificName !== undefined) plant.scientificName = scientificName;
            if (seasonalCare !== undefined) plant.seasonalCare = seasonalCare;
            if (soilRepotting !== undefined) plant.soilRepotting = soilRepotting;
            if (fertilization !== undefined) plant.fertilization = fertilization;
            plant.updatedAt = clientUpdated;
            await this.plantsRepo.save(plant);
            applied.plants.push(plant.id);
          }
        }
      }
    }

    // 1.4 RoomPlants
    if (changes.roomPlants?.length) {
      for (const item of changes.roomPlants) {
        if (item.deleted) {
          await this.deleteRoomPlantWithTombstone(userId, item.id);
          applied.roomPlants.push(item.id);
        } else {
          let rp = await this.roomPlantsRepo.findOne({
            where: { id: item.id, userId },
            relations: { plant: true },
          });
          const clientUpdated = new Date(item.updatedAt);
          const roomId = extractValue(item, 'roomId');
          const plantId = extractValue(item, 'plantId');
          const position = extractValue(item, 'position', null);
          const customFrequencyDays = extractValue(item, 'customFrequencyDays', null);
          const lastWateredAt = extractValue(item, 'lastWateredAt', null);
          const nextWateringDueAt = extractValue(item, 'nextWateringDueAt', null);
          const snoozedUntil = extractValue(item, 'snoozedUntil', null);
          const notes = extractValue(item, 'notes', null);

          if (!rp) {
            const plant = await this.plantsRepo.findOne({ where: { id: plantId!, userId } });
            const freq = getWateringFrequencyDays(plant, customFrequencyDays);
            const lastWatered = lastWateredAt ? new Date(lastWateredAt) : null;
            const nextDue = nextWateringDueAt
              ? new Date(nextWateringDueAt)
              : lastWatered
              ? computeNextWateringDate(lastWatered, freq)
              : new Date();

            rp = this.roomPlantsRepo.create({
              id: item.id,
              userId,
              roomId: roomId!,
              plantId: plantId!,
              position: position || null,
              customFrequencyDays: customFrequencyDays || null,
              lastWateredAt: lastWatered,
              nextWateringDueAt: nextDue,
              snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
              notes: notes || null,
            });
            rp.createdAt = clientUpdated;
            rp.updatedAt = clientUpdated;
            await this.roomPlantsRepo.save(rp);
            applied.roomPlants.push(rp.id);
          } else if (clientUpdated >= rp.updatedAt) {
            if (position !== undefined) rp.position = position;
            if (customFrequencyDays !== undefined) rp.customFrequencyDays = customFrequencyDays;
            if (lastWateredAt !== undefined) rp.lastWateredAt = lastWateredAt ? new Date(lastWateredAt) : null;
            if (nextWateringDueAt !== undefined) rp.nextWateringDueAt = nextWateringDueAt ? new Date(nextWateringDueAt) : null;
            if (snoozedUntil !== undefined) rp.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
            if (notes !== undefined) rp.notes = notes;
            rp.updatedAt = clientUpdated;
            await this.roomPlantsRepo.save(rp);
            applied.roomPlants.push(rp.id);
          }
        }
      }
    }

    // 1.5 Watering Logs
    if (changes.wateringLogs?.length) {
      for (const log of changes.wateringLogs) {
        const entry = this.wateringLogsRepo.create({
          id: log.id,
          userId,
          roomPlantId: log.roomPlantId,
          wateredAt: new Date(log.wateredAt),
          notes: log.notes || null,
          source: log.source || 'web',
        });
        await this.wateringLogsRepo.save(entry);
        applied.wateringLogs++;
      }
    }

    // 1.6 Settings
    if (changes.settings) {
      const s = await this.settingsRepo.findOne({ where: { userId } });
      if (s) {
        const preferredMapProvider = extractValue(changes.settings, 'preferredMapProvider');
        const themePreference = extractValue(changes.settings, 'themePreference');
        const emailNotificationsEnabled = extractValue(changes.settings, 'emailNotificationsEnabled');
        const notificationTime = extractValue(changes.settings, 'notificationTime');

        if (preferredMapProvider !== undefined) s.preferredMapProvider = preferredMapProvider;
        if (themePreference !== undefined) s.themePreference = themePreference;
        if (emailNotificationsEnabled !== undefined) s.emailNotificationsEnabled = emailNotificationsEnabled;
        if (notificationTime !== undefined) s.notificationTime = notificationTime;
        await this.settingsRepo.save(s);
        applied.settings = true;
      }
    }

    // 2. Fetch server changes since lastSyncDate
    const serverChanges = await this.fetchServerChanges(userId, lastSyncDate);

    return {
      serverTime,
      status: 'ok',
      conflicts,
      applied,
      serverChanges,
    };
  }

  async getFullState(userId: string) {
    const spaces = await this.spacesRepo.find({ where: { userId } });
    const rooms = await this.roomsRepo.find({ where: { userId } });
    const plants = await this.plantsRepo.find({ where: { userId }, relations: { attachments: true } });
    const roomPlants = await this.roomPlantsRepo.find({ where: { userId } });
    const settings = await this.settingsRepo.findOne({ where: { userId } });

    return {
      serverTime: new Date().toISOString(),
      spaces,
      rooms,
      plants,
      roomPlants,
      settings,
    };
  }

  private async fetchServerChanges(userId: string, since: Date | null) {
    const whereUpdated = (since: Date | null) =>
      since ? { userId, updatedAt: MoreThan(since) } : { userId };
    const whereDeleted = (since: Date | null, entityType: string) =>
      since
        ? { userId, entityType: entityType as any, deletedAt: MoreThan(since) }
        : { userId, entityType: entityType as any };

    const spaces = await this.spacesRepo.find({ where: whereUpdated(since) });
    const rooms = await this.roomsRepo.find({ where: whereUpdated(since) });
    const plants = await this.plantsRepo.find({
      where: whereUpdated(since),
      relations: { attachments: true },
    });
    const roomPlants = await this.roomPlantsRepo.find({ where: whereUpdated(since) });

    const deletedSpaces = await this.tombstonesRepo.find({ where: whereDeleted(since, 'space') });
    const deletedRooms = await this.tombstonesRepo.find({ where: whereDeleted(since, 'room') });
    const deletedPlants = await this.tombstonesRepo.find({ where: whereDeleted(since, 'plant') });
    const deletedRoomPlants = await this.tombstonesRepo.find({ where: whereDeleted(since, 'roomPlant') });

    const settings = since
      ? await this.settingsRepo.findOne({ where: { userId, updatedAt: MoreThan(since) } })
      : await this.settingsRepo.findOne({ where: { userId } });

    return {
      spaces,
      deletedSpaceIds: deletedSpaces.map((t) => t.entityId),
      rooms,
      deletedRoomIds: deletedRooms.map((t) => t.entityId),
      plants,
      deletedPlantIds: deletedPlants.map((t) => t.entityId),
      roomPlants,
      deletedRoomPlantIds: deletedRoomPlants.map((t) => t.entityId),
      settings: settings || null,
    };
  }

  private async deleteSpaceWithTombstone(userId: string, spaceId: string) {
    const space = await this.spacesRepo.findOne({ where: { id: spaceId, userId } });
    if (space) {
      await this.spacesRepo.remove(space);
    }
    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'space',
        entityId: spaceId,
      }),
    );
  }

  private async deleteRoomWithTombstone(userId: string, roomId: string) {
    const room = await this.roomsRepo.findOne({ where: { id: roomId, userId } });
    if (room) {
      await this.roomsRepo.remove(room);
    }
    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'room',
        entityId: roomId,
      }),
    );
  }

  private async deletePlantWithTombstone(userId: string, plantId: string) {
    const plant = await this.plantsRepo.findOne({ where: { id: plantId, userId } });
    if (plant) {
      await this.plantsRepo.remove(plant);
    }
    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'plant',
        entityId: plantId,
      }),
    );
  }

  private async deleteRoomPlantWithTombstone(userId: string, roomPlantId: string) {
    const rp = await this.roomPlantsRepo.findOne({ where: { id: roomPlantId, userId } });
    if (rp) {
      await this.roomPlantsRepo.remove(rp);
    }
    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'roomPlant',
        entityId: roomPlantId,
      }),
    );
  }
}
