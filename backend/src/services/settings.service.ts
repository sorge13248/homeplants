import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from '../entities/user-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
  ) {}

  async getSettings(userId: string): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepo.create({
        userId,
        preferredMapProvider: 'osm',
        themePreference: 'system',
        emailNotificationsEnabled: true,
        notificationTime: '08:00',
      });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(userId: string, update: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await this.getSettings(userId);
    Object.assign(settings, update);
    return this.settingsRepo.save(settings);
  }
}

