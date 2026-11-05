import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomPlant } from '../entities/room-plant.entity';
import { Plant, SeasonCareSchedule } from '../entities/plant.entity';
import { WateringLog } from '../entities/watering-log.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

export function getCurrentSeason(date = new Date()): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = date.getMonth(); // 0 to 11
  const day = date.getDate();

  if ((month === 2 && day >= 21) || month === 3 || month === 4 || (month === 5 && day < 21)) {
    return 'spring';
  }
  if ((month === 5 && day >= 21) || month === 6 || month === 7 || (month === 8 && day < 23)) {
    return 'summer';
  }
  if ((month === 8 && day >= 23) || month === 9 || month === 10 || (month === 11 && day < 21)) {
    return 'autumn';
  }
  return 'winter';
}

export function getWateringFrequencyDays(plant?: Plant | null, customFrequencyDays?: number | null, date = new Date()): number {
  if (customFrequencyDays && customFrequencyDays > 0) {
    return customFrequencyDays;
  }
  if (!plant || !plant.seasonalCare) {
    return 7; // Default 1 settimana
  }

  const season = getCurrentSeason(date);
  const schedule: SeasonCareSchedule | undefined = plant.seasonalCare[season];
  if (schedule?.watering?.frequencyDays && schedule.watering.frequencyDays > 0) {
    return schedule.watering.frequencyDays;
  }

  // Fallback a un'altra stagione disponibile
  for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
    if (plant.seasonalCare[s]?.watering?.frequencyDays) {
      return plant.seasonalCare[s]!.watering!.frequencyDays!;
    }
  }

  return 7;
}

export function computeNextWateringDate(
  lastWateredDate: Date,
  frequencyDays: number,
): Date {
  const next = new Date(lastWateredDate.getTime());
  next.setDate(next.getDate() + frequencyDays);
  return next;
}

@Injectable()
export class RoomPlantsService {
  constructor(
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    @InjectRepository(Plant)
    private readonly plantsRepo: Repository<Plant>,
    @InjectRepository(WateringLog)
    private readonly wateringLogsRepo: Repository<WateringLog>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {}

  async findAll(userId: string, roomId?: string): Promise<RoomPlant[]> {
    const where: any = { userId };
    if (roomId) {
      where.roomId = roomId;
    }
    return this.roomPlantsRepo.find({
      where,
      relations: { room: { space: true }, plant: { attachments: true }, wateringLogs: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<RoomPlant> {
    const rp = await this.roomPlantsRepo.findOne({
      where: { id, userId },
      relations: { room: { space: true }, plant: { attachments: true }, wateringLogs: true },
    });
    if (!rp) {
      throw new NotFoundException(`RoomPlant ${id} not found`);
    }
    return rp;
  }

  async create(userId: string, data: Partial<RoomPlant>): Promise<RoomPlant> {
    const plant = await this.plantsRepo.findOne({ where: { id: data.plantId, userId } });
    const frequencyDays = getWateringFrequencyDays(plant, data.customFrequencyDays);

    let nextWateringDueAt = data.nextWateringDueAt;
    if (data.lastWateredAt && !nextWateringDueAt) {
      nextWateringDueAt = computeNextWateringDate(new Date(data.lastWateredAt), frequencyDays);
    } else if (!data.lastWateredAt && !nextWateringDueAt) {
      // Se non specificato, impostiamo il promemoria a oggi
      nextWateringDueAt = new Date();
    }

    const rp = this.roomPlantsRepo.create({
      ...data,
      userId,
      nextWateringDueAt,
    });

    const saved = await this.roomPlantsRepo.save(rp);

    // Se è stata registrata un'innaffiatura iniziale
    if (data.lastWateredAt) {
      await this.wateringLogsRepo.save(
        this.wateringLogsRepo.create({
          userId,
          roomPlantId: saved.id,
          wateredAt: new Date(data.lastWateredAt),
          source: 'web',
          notes: 'Innaffiatura iniziale al posizionamento',
        }),
      );
    }

    return this.findOne(userId, saved.id);
  }

  async update(userId: string, id: string, data: Partial<RoomPlant>): Promise<RoomPlant> {
    const rp = await this.findOne(userId, id);

    if (data.customFrequencyDays !== undefined && data.customFrequencyDays !== rp.customFrequencyDays) {
      rp.customFrequencyDays = data.customFrequencyDays;
      if (rp.lastWateredAt) {
        const freq = getWateringFrequencyDays(rp.plant, rp.customFrequencyDays);
        rp.nextWateringDueAt = computeNextWateringDate(new Date(rp.lastWateredAt), freq);
      }
    }

    Object.assign(rp, data);
    await this.roomPlantsRepo.save(rp);
    return this.findOne(userId, id);
  }

  async delete(userId: string, id: string): Promise<void> {
    const rp = await this.findOne(userId, id);

    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'roomPlant',
        entityId: id,
      }),
    );

    await this.roomPlantsRepo.remove(rp);
  }

  async water(
    userId: string,
    id: string,
    options?: { date?: Date; notes?: string; source?: 'web' | 'email-quick-action' | 'bulk-room' },
  ): Promise<RoomPlant> {
    const rp = await this.findOne(userId, id);
    const wateredAt = options?.date ?? new Date();
    const source = options?.source ?? 'web';

    const frequencyDays = getWateringFrequencyDays(rp.plant, rp.customFrequencyDays, wateredAt);
    rp.lastWateredAt = wateredAt;
    rp.nextWateringDueAt = computeNextWateringDate(wateredAt, frequencyDays);
    rp.snoozedUntil = null; // Resetta eventuale snooze

    await this.roomPlantsRepo.save(rp);

    await this.wateringLogsRepo.save(
      this.wateringLogsRepo.create({
        userId,
        roomPlantId: rp.id,
        wateredAt,
        source,
        notes: options?.notes ?? null,
      }),
    );

    return this.findOne(userId, id);
  }

  async waterAllInRoom(userId: string, roomId: string): Promise<RoomPlant[]> {
    const roomPlants = await this.roomPlantsRepo.find({
      where: { roomId, userId },
      relations: { plant: true },
    });

    const now = new Date();
    for (const rp of roomPlants) {
      const frequencyDays = getWateringFrequencyDays(rp.plant, rp.customFrequencyDays, now);
      rp.lastWateredAt = now;
      rp.nextWateringDueAt = computeNextWateringDate(now, frequencyDays);
      rp.snoozedUntil = null;
      await this.roomPlantsRepo.save(rp);

      await this.wateringLogsRepo.save(
        this.wateringLogsRepo.create({
          userId,
          roomPlantId: rp.id,
          wateredAt: now,
          source: 'bulk-room',
          notes: 'Innaffiatura cumulativa stanza',
        }),
      );
    }

    return this.findAll(userId, roomId);
  }

  async snooze(userId: string, id: string, hours: number): Promise<RoomPlant> {
    const rp = await this.findOne(userId, id);
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    rp.snoozedUntil = until;
    await this.roomPlantsRepo.save(rp);
    return this.findOne(userId, id);
  }
}
