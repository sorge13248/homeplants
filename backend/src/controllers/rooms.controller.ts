import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { RoomsService } from '../services/rooms.service';
import { Room } from '../entities/room.entity';

@Controller('rooms')
@UseGuards(BearerJwtGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query('spaceId') spaceId?: string) {
    return this.roomsService.findAll(user.id, spaceId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.roomsService.findOne(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() data: Partial<Room>) {
    return this.roomsService.create(user.id, data);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() data: Partial<Room>) {
    return this.roomsService.update(user.id, id, data);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.roomsService.delete(user.id, id);
    return { success: true };
  }
}

