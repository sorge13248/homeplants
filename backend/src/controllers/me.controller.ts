import { Controller, Get, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';

@Controller('me')
@UseGuards(BearerJwtGuard)
export class MeController {
  @Get()
  getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }
}

