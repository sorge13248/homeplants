import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { AuthUser } from '../common/auth/auth.types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly settingsRepository: Repository<UserSettings>,
  ) {}

  async ensureUser(authUser: AuthUser): Promise<User> {
    let user = await this.usersRepository.findOne({
      where: { subject: authUser.subject },
    });

    if (!user) {
      user = this.usersRepository.create({
        subject: authUser.subject,
        email: authUser.email,
        displayName: authUser.displayName,
        pictureUrl: authUser.pictureUrl,
      });
      user = await this.usersRepository.save(user);

      // Create default settings for user
      const settings = this.settingsRepository.create({
        userId: user.id,
        preferredMapProvider: 'osm',
        themePreference: 'system',
        emailNotificationsEnabled: true,
        notificationTime: '08:00',
      });
      await this.settingsRepository.save(settings);
    } else {
      // Update fields if changed
      let changed = false;
      if (authUser.email !== undefined && user.email !== authUser.email) {
        user.email = authUser.email;
        changed = true;
      }
      if (authUser.displayName && user.displayName !== authUser.displayName) {
        user.displayName = authUser.displayName;
        changed = true;
      }
      if (authUser.pictureUrl !== undefined && user.pictureUrl !== authUser.pictureUrl) {
        user.pictureUrl = authUser.pictureUrl;
        changed = true;
      }
      if (changed) {
        user = await this.usersRepository.save(user);
      }
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}

