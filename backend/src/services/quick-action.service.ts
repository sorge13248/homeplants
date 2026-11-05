import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { QuickActionToken } from '../entities/quick-action-token.entity';
import { RoomPlantsService } from './room-plants.service';
import { RoomPlant } from '../entities/room-plant.entity';

@Injectable()
export class QuickActionService {
  constructor(
    @InjectRepository(QuickActionToken)
    private readonly tokenRepo: Repository<QuickActionToken>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    private readonly roomPlantsService: RoomPlantsService,
  ) {}

  async createToken(
    userId: string,
    roomPlantId: string,
    action: 'water' | 'snooze',
    expiresInHours = 72,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const record = this.tokenRepo.create({
      token,
      userId,
      roomPlantId,
      action,
      expiresAt,
      used: false,
    });

    await this.tokenRepo.save(record);
    return token;
  }

  async resolveToken(token: string) {
    const record = await this.tokenRepo.findOne({ where: { token } });
    if (!record) {
      throw new NotFoundException('Token non valido o inesistente');
    }
    if (record.used) {
      throw new BadRequestException('Questa azione è già stata utilizzata');
    }
    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Questo link è scaduto');
    }

    const roomPlant = await this.roomPlantsRepo.findOne({
      where: { id: record.roomPlantId },
      relations: { plant: true, room: { space: true } },
    });

    if (!roomPlant) {
      throw new NotFoundException('Pianta o stanza non più disponibile');
    }

    return { tokenRecord: record, roomPlant };
  }

  async executeWater(token: string) {
    const { tokenRecord, roomPlant } = await this.resolveToken(token);

    await this.roomPlantsService.water(tokenRecord.userId, roomPlant.id, {
      source: 'email-quick-action',
      notes: 'Innaffiata tramite azione rapida email',
    });

    tokenRecord.used = true;
    await this.tokenRepo.save(tokenRecord);

    return { success: true, roomPlant };
  }

  async executeSnooze(token: string, hours: number) {
    const { tokenRecord, roomPlant } = await this.resolveToken(token);

    await this.roomPlantsService.snooze(tokenRecord.userId, roomPlant.id, hours);

    tokenRecord.used = true;
    await this.tokenRepo.save(tokenRecord);

    return { success: true, hours, roomPlant };
  }

  async cleanExpiredTokens(): Promise<void> {
    await this.tokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}
