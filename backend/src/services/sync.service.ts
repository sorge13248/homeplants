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

          if (!space) {
            space = this.spacesRepo.create({
              id: item.id,
              userId,
              name: item.name || 'Nuovo Spazio',
              location: item.location || null,
              description: item.description || null,
              coverPhotoUrl: item.coverPhotoUrl || null,
            });
            await this.spacesRepo.save(space);
            applied.spaces.push(space.id);
          } else if (clientUpdated >= space.updatedAt) {
            space.name = item.name ?? space.name;
            space.location = item.location !== undefined ? item.location : space.location;
            space.description = item.description !== undefined ? item.description : space.description;
            space.coverPhotoUrl = item.coverPhotoUrl !== undefined ? item.coverPhotoUrl : space.coverPhotoUrl;
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

          if (!room) {
            room = this.roomsRepo.create({
              id: item.id,
              userId,
              spaceId: item.spaceId!,
              name: item.name || 'Nuova Stanza',
              description: item.description || null,
              coverPhotoUrl: item.coverPhotoUrl || null,
            });
            await this.roomsRepo.save(room);
            applied.rooms.push(room.id);
          } else if (clientUpdated >= room.updatedAt) {
            room.name = item.name ?? room.name;
            room.description = item.description !== undefined ? item.description : room.description;
            room.coverPhotoUrl = item.coverPhotoUrl !== undefined ? item.coverPhotoUrl : room.coverPhotoUrl;
            if (item.spaceId) room.spaceId = item.spaceId;
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

          if (!plant) {
            plant = this.plantsRepo.create({
              id: item.id,
              userId,
              commonName: item.commonName || 'Nuova Pianta',
              scientificName: item.scientificName || null,
              seasonalCare: item.seasonalCare || null,
              soilRepotting: item.soilRepotting || null,
              fertilization: item.fertilization || null,
            });
            await this.plantsRepo.save(plant);
            applied.plants.push(plant.id);
          } else if (clientUpdated >= plant.updatedAt) {
            plant.commonName = item.commonName ?? plant.commonName;
            plant.scientificName = item.scientificName !== undefined ? item.scientificName : plant.scientificName;
            plant.seasonalCare = item.seasonalCare !== undefined ? item.seasonalCare : plant.seasonalCare;
            plant.soilRepotting = item.soilRepotting !== undefined ? item.soilRepotting : plant.soilRepotting;
            plant.fertilization = item.fertilization !== undefined ? item.fertilization : plant.fertilization;
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

          if (!rp) {
            const plant = await this.plantsRepo.findOne({ where: { id: item.plantId, userId } });
            const freq = getWateringFrequencyDays(plant, item.customFrequencyDays);
            const lastWatered = item.lastWateredAt ? new Date(item.lastWateredAt) : null;
            const nextDue = item.nextWateringDueAt
              ? new Date(item.nextWateringDueAt)
              : lastWatered
              ? computeNextWateringDate(lastWatered, freq)
              : new Date();

            rp = this.roomPlantsRepo.create({
              id: item.id,
              userId,
              roomId: item.roomId!,
              plantId: item.plantId!,
              position: item.position || null,
              customFrequencyDays: item.customFrequencyDays || null,
              lastWateredAt: lastWatered,
              nextWateringDueAt: nextDue,
              snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil) : null,
              notes: item.notes || null,
            });
            await this.roomPlantsRepo.save(rp);
            applied.roomPlants.push(rp.id);
          } else if (clientUpdated >= rp.updatedAt) {
            rp.position = item.position !== undefined ? item.position : rp.position;
            rp.customFrequencyDays = item.customFrequencyDays !== undefined ? item.customFrequencyDays : rp.customFrequencyDays;
            if (item.lastWateredAt) rp.lastWateredAt = new Date(item.lastWateredAt);
            if (item.nextWateringDueAt) rp.nextWateringDueAt = new Date(item.nextWateringDueAt);
            if (item.snoozedUntil !== undefined) rp.snoozedUntil = item.snoozedUntil ? new Date(item.snoozedUntil) : null;
            rp.notes = item.notes !== undefined ? item.notes : rp.notes;
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
        if (changes.settings.preferredMapProvider) s.preferredMapProvider = changes.settings.preferredMapProvider;
        if (changes.settings.themePreference) s.themePreference = changes.settings.themePreference;
        if (changes.settings.emailNotificationsEnabled !== undefined) s.emailNotificationsEnabled = changes.settings.emailNotificationsEnabled;
        if (changes.settings.notificationTime) s.notificationTime = changes.settings.notificationTime;
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
