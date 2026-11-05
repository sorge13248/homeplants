import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { RoomPlantsService } from '../services/room-plants.service';
import { RoomPlant } from '../entities/room-plant.entity';

@Controller('room-plants')
@UseGuards(BearerJwtGuard)
export class RoomPlantsController {
  constructor(private readonly roomPlantsService: RoomPlantsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query('roomId') roomId?: string) {
    return this.roomPlantsService.findAll(user.id, roomId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.roomPlantsService.findOne(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() data: Partial<RoomPlant>) {
    return this.roomPlantsService.create(user.id, data);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() data: Partial<RoomPlant>) {
    return this.roomPlantsService.update(user.id, id, data);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.roomPlantsService.delete(user.id, id);
    return { success: true };
  }

  @Post(':id/water')
  async water(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: { date?: string; notes?: string },
  ) {
    return this.roomPlantsService.water(user.id, id, {
      date: body?.date ? new Date(body.date) : undefined,
      notes: body?.notes,
      source: 'web',
    });
  }

  @Post('room/:roomId/water-all')
  async waterAllInRoom(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.roomPlantsService.waterAllInRoom(user.id, roomId);
  }

  @Post(':id/snooze')
  async snooze(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { hours: number },
  ) {
    const hours = Number(body?.hours) || 24;
    return this.roomPlantsService.snooze(user.id, id, hours);
  }
}

