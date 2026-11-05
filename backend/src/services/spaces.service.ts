import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Space } from '../entities/space.entity';
import { Room } from '../entities/room.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {}

  async findAll(userId: string): Promise<Space[]> {
    const spaces = await this.spacesRepo.find({
      where: { userId },
      relations: { rooms: true },
      order: { name: 'ASC' },
    });
    for (const space of spaces) {
      if (space.rooms) {
        space.rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
    }
    return spaces;
  }

  async findOne(userId: string, id: string): Promise<Space> {
    const space = await this.spacesRepo.findOne({
      where: { id, userId },
      relations: { rooms: { roomPlants: { plant: true } } },
    });
    if (!space) {
      throw new NotFoundException(`Space ${id} not found`);
    }
    if (space.rooms) {
      space.rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      for (const room of space.rooms) {
        if (room.roomPlants) {
          room.roomPlants.sort((a, b) =>
            (a.plant?.commonName || a.plant?.scientificName || '').localeCompare(
              b.plant?.commonName || b.plant?.scientificName || '',
            ),
          );
        }
      }
    }
    return space;
  }

  async create(userId: string, data: Partial<Space>): Promise<Space> {
    const space = this.spacesRepo.create({
      ...data,
      userId,
    });
    return this.spacesRepo.save(space);
  }

  async update(userId: string, id: string, data: Partial<Space>): Promise<Space> {
    const space = await this.findOne(userId, id);
    Object.assign(space, data);
    return this.spacesRepo.save(space);
  }

  async delete(userId: string, id: string): Promise<void> {
    const space = await this.findOne(userId, id);

    // Find all rooms in this space
    const rooms = await this.roomsRepo.find({ where: { spaceId: id, userId } });
    for (const room of rooms) {
      const rps = await this.roomPlantsRepo.find({ where: { roomId: room.id, userId } });
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
          entityId: room.id,
        }),
      );
    }

    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'space',
        entityId: id,
      }),
    );

    await this.spacesRepo.remove(space);
  }
}
