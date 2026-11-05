import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plant } from '../entities/plant.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

@Injectable()
export class PlantsService {
  constructor(
    @InjectRepository(Plant)
    private readonly plantsRepo: Repository<Plant>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {}

  async findAll(userId: string): Promise<Plant[]> {
    return this.plantsRepo.find({
      where: { userId },
      relations: { attachments: true, roomPlants: { room: { space: true } } },
      order: { commonName: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Plant> {
    const plant = await this.plantsRepo.findOne({
      where: { id, userId },
      relations: { attachments: true, roomPlants: { room: { space: true } } },
    });
    if (!plant) {
      throw new NotFoundException(`Plant ${id} not found`);
    }
    return plant;
  }

  async create(userId: string, data: Partial<Plant>): Promise<Plant> {
    const plant = this.plantsRepo.create({
      ...data,
      userId,
    });
    return this.plantsRepo.save(plant);
  }

  async update(userId: string, id: string, data: Partial<Plant>): Promise<Plant> {
    const plant = await this.findOne(userId, id);
    Object.assign(plant, data);
    return this.plantsRepo.save(plant);
  }

  async delete(userId: string, id: string): Promise<void> {
    const plant = await this.findOne(userId, id);

    const rps = await this.roomPlantsRepo.find({ where: { plantId: id, userId } });
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
        entityType: 'plant',
        entityId: id,
      }),
    );

    await this.plantsRepo.remove(plant);
  }
}
