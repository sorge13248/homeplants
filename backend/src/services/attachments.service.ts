import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Attachment } from '../entities/attachment.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

@Injectable()
export class AttachmentsService {
  private uploadsDir: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepo: Repository<Attachment>,
    @InjectRepository(SyncTombstone)
    private readonly tombstonesRepo: Repository<SyncTombstone>,
  ) {
    this.uploadsDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || '../uploads');
    void this.ensureDirectory();
  }

  private async ensureDirectory() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadsDir, 'previews'), { recursive: true });
    } catch {
      // Directory already exists or created
    }
  }

  async saveFile(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    metadata?: {
      plantId?: string;
      spaceId?: string;
      roomId?: string;
      sortOrder?: number;
    },
  ): Promise<Attachment> {
    await this.ensureDirectory();

    const id = randomUUID();
    const ext = path.extname(originalName) || '.webp';
    const fileName = `${id}${ext}`;
    const previewFileName = `preview_${id}.webp`;

    const filePath = path.join(this.uploadsDir, fileName);
    const previewPath = path.join(this.uploadsDir, 'previews', previewFileName);

    // Comprimi e ottimizza l'originale (max 1920px)
    const optimizedBuffer = await sharp(fileBuffer)
      .rotate()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await fs.writeFile(filePath, optimizedBuffer);

    // Genera thumbnail compatto per le card (max 600px)
    const previewBuffer = await sharp(fileBuffer)
      .rotate()
      .resize(600, 600, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer();

    await fs.writeFile(previewPath, previewBuffer);

    const attachment = this.attachmentsRepo.create({
      id,
      userId,
      fileName,
      originalName,
      mimeType: 'image/webp',
      size: optimizedBuffer.length,
      path: `/api/attachments/file/${fileName}`,
      previewPath: `/api/attachments/file/previews/${previewFileName}`,
      plantId: metadata?.plantId || null,
      spaceId: metadata?.spaceId || null,
      roomId: metadata?.roomId || null,
      sortOrder: metadata?.sortOrder ?? 0,
    });

    return this.attachmentsRepo.save(attachment);
  }

  async findById(id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepo.findOne({ where: { id } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }
    return attachment;
  }

  async findOne(userId: string, id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepo.findOne({ where: { id, userId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }
    return attachment;
  }

  async getFilePath(fileName: string): Promise<string> {
    const filePath = path.join(this.uploadsDir, fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException(`File ${fileName} not found`);
    }
  }

  async getFilePathById(id: string): Promise<{ filePath: string; mimeType: string }> {
    const attachment = await this.findById(id);
    const filePath = path.join(this.uploadsDir, attachment.fileName);
    try {
      await fs.access(filePath);
      return { filePath, mimeType: attachment.mimeType || 'image/webp' };
    } catch {
      throw new NotFoundException(`File for attachment ${id} not found`);
    }
  }

  async getPreviewFilePathById(id: string): Promise<{ filePath: string; mimeType: string }> {
    const attachment = await this.findById(id);
    if (attachment.previewPath) {
      const previewFileName = path.basename(attachment.previewPath);
      const previewFilePath = path.join(this.uploadsDir, 'previews', previewFileName);
      try {
        await fs.access(previewFilePath);
        return { filePath: previewFilePath, mimeType: 'image/webp' };
      } catch {
        // Fallback to main file below
      }
    }
    return this.getFilePathById(id);
  }

  async delete(userId: string, id: string): Promise<void> {
    const attachment = await this.findOne(userId, id);

    try {
      await fs.unlink(path.join(this.uploadsDir, attachment.fileName));
      if (attachment.previewPath) {
        const previewName = path.basename(attachment.previewPath);
        await fs.unlink(path.join(this.uploadsDir, 'previews', previewName));
      }
    } catch {
      // Ignora se già cancellato dal filesystem
    }

    await this.tombstonesRepo.save(
      this.tombstonesRepo.create({
        userId,
        entityType: 'attachment',
        entityId: id,
      }),
    );

    await this.attachmentsRepo.remove(attachment);
  }
}

