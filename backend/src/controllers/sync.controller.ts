import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { SyncService } from '../services/sync.service';
import { SyncPayloadDto } from '../common/sync/sync.types';

@Controller('sync')
@UseGuards(BearerJwtGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async sync(@CurrentUser() user: AuthUser, @Body() payload: SyncPayloadDto) {
    return this.syncService.processSync(user.id, payload);
  }

  @Get('full-state')
  async getFullState(@CurrentUser() user: AuthUser) {
    return this.syncService.getFullState(user.id);
  }
}

