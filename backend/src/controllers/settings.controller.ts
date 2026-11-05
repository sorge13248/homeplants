import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { SettingsService } from '../services/settings.service';
import { UsersService } from '../services/users.service';
import { EmailNotificationService } from '../services/email-notification.service';
import { UserSettings } from '../entities/user-settings.entity';

@Controller('settings')
@UseGuards(BearerJwtGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  @Get()
  async getSettings(@CurrentUser() user: AuthUser) {
    return this.settingsService.getSettings(user.id);
  }

  @Put()
  async updateSettings(@CurrentUser() user: AuthUser, @Body() body: Partial<UserSettings>) {
    return this.settingsService.updateSettings(user.id, body);
  }

  @Post('test-notification')
  async sendTestNotification(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.id);
    if (!user) {
      return { success: false, message: 'Utente non trovato' };
    }
    const sent = await this.emailNotificationService.sendDailyDigestForUser(user);
    return {
      success: true,
      sent,
      message: sent
        ? 'Email di promemoria inviata con successo!'
        : 'Nessuna pianta richiede innaffiatura oggi, oppure nessun indirizzo email configurato per l’utente.',
    };
  }
}
