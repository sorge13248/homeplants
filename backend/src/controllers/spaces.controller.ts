import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { SpacesService } from '../services/spaces.service';
import { Space } from '../entities/space.entity';

@Controller('spaces')
@UseGuards(BearerJwtGuard)
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return this.spacesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.findOne(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() data: Partial<Space>) {
    return this.spacesService.create(user.id, data);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() data: Partial<Space>) {
    return this.spacesService.update(user.id, id, data);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.spacesService.delete(user.id, id);
    return { success: true };
  }
}

