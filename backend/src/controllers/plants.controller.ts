import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { PlantsService } from '../services/plants.service';
import { Plant } from '../entities/plant.entity';

@Controller('plants')
@UseGuards(BearerJwtGuard)
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return this.plantsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plantsService.findOne(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() data: Partial<Plant>) {
    return this.plantsService.create(user.id, data);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() data: Partial<Plant>) {
    return this.plantsService.update(user.id, id, data);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.plantsService.delete(user.id, id);
    return { success: true };
  }
}

