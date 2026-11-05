import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'node:path';

// Entities
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { Space } from './entities/space.entity';
import { Room } from './entities/room.entity';
import { Plant } from './entities/plant.entity';
import { RoomPlant } from './entities/room-plant.entity';
import { WateringLog } from './entities/watering-log.entity';
import { QuickActionToken } from './entities/quick-action-token.entity';
import { Attachment } from './entities/attachment.entity';
import { SyncTombstone } from './entities/sync-tombstone.entity';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { MeController } from './controllers/me.controller';
import { SettingsController } from './controllers/settings.controller';
import { SpacesController } from './controllers/spaces.controller';
import { RoomsController } from './controllers/rooms.controller';
import { PlantsController } from './controllers/plants.controller';
import { RoomPlantsController } from './controllers/room-plants.controller';
import { QuickActionController } from './controllers/quick-action.controller';
import { AttachmentsController } from './controllers/attachments.controller';
import { SyncController } from './controllers/sync.controller';

// Services
import { UsersService } from './services/users.service';
import { SettingsService } from './services/settings.service';
import { SpacesService } from './services/spaces.service';
import { RoomsService } from './services/rooms.service';
import { PlantsService } from './services/plants.service';
import { RoomPlantsService } from './services/room-plants.service';
import { QuickActionService } from './services/quick-action.service';
import { EmailNotificationService } from './services/email-notification.service';
import { AttachmentsService } from './services/attachments.service';
import { SyncService } from './services/sync.service';
import { BearerJwtGuard } from './common/auth/bearer-jwt.guard';

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH ?? '../homeplants.sqlite');

const entities = [
  User,
  UserSettings,
  Space,
  Room,
  Plant,
  RoomPlant,
  WateringLog,
  QuickActionToken,
  Attachment,
  SyncTombstone,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: dbPath,
      entities,
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      logging: process.env.DB_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(entities),
  ],
  controllers: [
    AuthController,
    HealthController,
    MeController,
    SettingsController,
    SpacesController,
    RoomsController,
    PlantsController,
    RoomPlantsController,
    QuickActionController,
    AttachmentsController,
    SyncController,
  ],
  providers: [
    UsersService,
    SettingsService,
    SpacesService,
    RoomsService,
    PlantsService,
    RoomPlantsService,
    QuickActionService,
    EmailNotificationService,
    AttachmentsService,
    SyncService,
    BearerJwtGuard,
  ],
})
export class AppModule {}
