import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {}

  async findAll(userId: string, spaceId?: string): Promise<Room[]> {
    const where: any = { userId };
    if (spaceId) {
      where.spaceId = spaceId;
    }
    const rooms = await this.roomsRepo.find({
      where,
      relations: { roomPlants: { plant: { attachments: true } } },
      order: { name: 'ASC' },
    });
    for (const room of rooms) {
      if (room.roomPlants) {
        room.roomPlants.sort((a, b) =>
          (a.plant?.commonName || a.plant?.scientificName || '').localeCompare(
            b.plant?.commonName || b.plant?.scientificName || '',
          ),
        );
      }
    }
    return rooms;
  }

  async findOne(userId: string, id: string): Promise<Room> {
    const room = await this.roomsRepo.findOne({
      where: { id, userId },
      relations: { space: true, roomPlants: { plant: { attachments: true } } },
    });
    if (!room) {
      throw new NotFoundException(`Room ${id} not found`);
    }
    if (room.roomPlants) {
      room.roomPlants.sort((a, b) =>
        (a.plant?.commonName || a.plant?.scientificName || '').localeCompare(
          b.plant?.commonName || b.plant?.scientificName || '',
        ),
      );
    }
    return room;
  }

  async create(userId: string, data: Partial<Room>): Promise<Room> {
    const room = this.roomsRepo.create({
      ...data,
      userId,
    });
    return this.roomsRepo.save(room);
  }

  async update(userId: string, id: string, data: Partial<Room>): Promise<Room> {
    const room = await this.findOne(userId, id);
    Object.assign(room, data);
    return this.roomsRepo.save(room);
  }

  async delete(userId: string, id: string): Promise<void> {
    const room = await this.findOne(userId, id);

    const rps = await this.roomPlantsRepo.find({ where: { roomId: id, userId } });
    for (const rp of rps) {
      await this.tombstonesRepo.save(
        this.tombstonesRepo.create({
          userId,
          entityType: 'roomPlant',
          entityId: rp.id,
        }),
      );
    }

    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'room',
        entityId: id,
      }),
    );

    await this.roomsRepo.remove(room);
  }
}
