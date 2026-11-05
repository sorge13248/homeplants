import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { User } from '../entities/user.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { QuickActionService } from './quick-action.service';
import { getCurrentSeason } from './room-plants.service';

@Injectable()
export class EmailNotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    @InjectRepository(RoomPlant)
    private readonly roomPlantsRepo: Repository<RoomPlant>,
    private readonly quickActionService: QuickActionService,
  ) {
    this.initTransporter();
  }

  onModuleInit() {
    // Esecuzione programmata ogni 15 minuti per controllare gli orari preferiti degli utenti
    this.intervalTimer = setInterval(() => {
      void this.handleScheduledNotifications();
    }, 15 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
      this.logger.log(`SMTP configured with host: ${host}`);
    } else {
      this.logger.log('SMTP not configured; email notifications will be logged to console.');
    }
  }

  async handleScheduledNotifications() {
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = now.getMinutes() < 30 ? '00' : '30';
    const currentTimeSlot = `${currentHour}:${currentMinute}`;

    const activeSettings = await this.settingsRepo.find({
      where: { emailNotificationsEnabled: true },
    });

    for (const setting of activeSettings) {
      const targetTime = setting.notificationTime || '08:00';
      const [targetHour, targetMinute] = targetTime.split(':');
      const roundedTarget = `${targetHour.padStart(2, '0')}:${Number(targetMinute) < 30 ? '00' : '30'}`;

      if (roundedTarget === currentTimeSlot) {
        const user = await this.usersRepo.findOne({ where: { id: setting.userId } });
        if (user && user.email) {
          await this.sendDailyDigestForUser(user);
        }
      }
    }
  }

  async sendDailyDigestForUser(user: User): Promise<boolean> {
    if (!user.email) {
      return false;
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const allPlants = await this.roomPlantsRepo.find({
      where: { userId: user.id },
      relations: { plant: true, room: { space: true } },
    });

    const thirstyPlants = allPlants.filter((rp) => {
      if (rp.snoozedUntil && new Date(rp.snoozedUntil) > new Date()) {
        return false;
      }
      if (!rp.nextWateringDueAt) {
        return true;
      }
      return new Date(rp.nextWateringDueAt) <= endOfToday;
    });

    if (thirstyPlants.length === 0) {
      this.logger.log(`Nessuna pianta da innaffiare oggi per l'utente ${user.displayName}`);
      return false;
    }

    const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:4200').replace(/\/$/, '');
    const plantCardsHtml: string[] = [];

    const currentSeason = getCurrentSeason();

    for (const rp of thirstyPlants) {
      const waterToken = await this.quickActionService.createToken(user.id, rp.id, 'water');
      const snoozeToken = await this.quickActionService.createToken(user.id, rp.id, 'snooze');

      const plantName = rp.plant?.commonName || 'Pianta';
      const sciName = rp.plant?.scientificName ? `<em>(${rp.plant.scientificName})</em>` : '';
      const spaceName = rp.room?.space?.name || 'Spazio';
      const roomName = rp.room?.name || 'Stanza';
      const position = rp.position ? ` &bull; Posizione: ${rp.position}` : '';

      const seasonSchedule = rp.plant?.seasonalCare?.[currentSeason];
      let adviceText = '';
      if (seasonSchedule?.watering?.advices) {
        adviceText = `&bull; <strong>Consiglio:</strong> ${seasonSchedule.watering.advices}`;
      } else if (seasonSchedule?.watering?.drySoilOnly) {
        adviceText = `&bull; <strong>Consiglio:</strong> Innaffiare solo a terriccio asciutto`;
      }

      const waterUrl = `${appBaseUrl}/api/quick-action/water/${waterToken}`;
      const snoozeUrl = `${appBaseUrl}/api/quick-action/snooze/${snoozeToken}`;

      plantCardsHtml.push(`
        <div style="background-color: #f7faf8; border: 1px solid #d1fae5; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 4px 0; color: #064e3b; font-size: 16px;">${plantName} ${sciName}</h3>
          <p style="margin: 0 0 10px 0; color: #047857; font-size: 13px;">${spaceName} &rsaquo; ${roomName}${position}</p>
          ${adviceText ? `<p style="margin: 0 0 14px 0; color: #065f46; font-size: 13px; background: #ecfdf5; padding: 6px 10px; border-radius: 6px;">${adviceText}</p>` : ''}
          <div style="margin-top: 10px;">
            <a href="${waterUrl}" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; margin-right: 8px;">&check; Innaffiata</a>
            <a href="${snoozeUrl}" style="background-color: #e5e7eb; color: #374151; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; display: inline-block;">&clock; Ricorda fra...</a>
          </div>
        </div>
      `);
    }

    const emailSubject = `🌿 HomePlants: ${thirstyPlants.length} ${thirstyPlants.length === 1 ? 'pianta ha' : 'piante hanno'} sete oggi`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
          .header { background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #ffffff; padding: 24px; text-align: center; }
          .content { padding: 24px; }
          .footer { text-align: center; padding: 16px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px;">🌱 Promemoria Piante di Oggi</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Buongiorno ${user.displayName || 'Giardiniere'}! Ecco le piante che necessitano d'acqua:</p>
          </div>
          <div class="content">
            ${plantCardsHtml.join('')}
            <div style="text-align: center; margin-top: 24px;">
              <a href="${appBaseUrl}" style="color: #047857; text-decoration: underline; font-size: 14px; font-weight: 600;">Apri la tua dashboard su HomePlants &rarr;</a>
            </div>
          </div>
          <div class="footer">
            <p>Ricevi questa email perché hai abilitato le notifiche su HomePlants.<br>Puoi disattivarle o modificare l'orario nella schermata Impostazioni.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fromAddress = process.env.SMTP_FROM || '"HomePlants" <noreply@homeplants.local>';

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: user.email,
          subject: emailSubject,
          html: emailHtml,
        });
        this.logger.log(`Digest email inviata con successo a ${user.email}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Errore durante l'invio dell'email a ${user.email}: ${err.message}`);
        return false;
      }
    } else {
      this.logger.log(`[DRY RUN EMAIL] A: ${user.email} | Oggetto: ${emailSubject}`);
      this.logger.log(`[DRY RUN EMAIL BODY]\n${thirstyPlants.map((p) => ` - ${p.plant?.commonName} in ${p.room?.name}`).join('\n')}`);
      return true;
    }
  }
}
