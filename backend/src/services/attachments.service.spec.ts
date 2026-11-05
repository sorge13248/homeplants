import 'reflect-metadata';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource, Repository } from 'typeorm';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AttachmentsService } from './attachments.service';
import { Space } from '../entities/space.entity';
import { Room } from '../entities/room.entity';
import { Plant } from '../entities/plant.entity';
import { RoomPlant } from '../entities/room-plant.entity';
import { UserSettings } from '../entities/user-settings.entity';
import { WateringLog } from '../entities/watering-log.entity';
import { Attachment } from '../entities/attachment.entity';
import { User } from '../entities/user.entity';
import { QuickActionToken } from '../entities/quick-action-token.entity';
import { SyncTombstone } from '../entities/sync-tombstone.entity';

describe('AttachmentsService', () => {
  let dataSource: DataSource;
  let attachmentsRepo: Repository<Attachment>;
  let tombstonesRepo: Repository<SyncTombstone>;
  let service: AttachmentsService;
  const testUploadsDir = path.resolve(process.cwd(), 'test-uploads-temp');

  beforeEach(async () => {
    process.env.UPLOADS_DIR = testUploadsDir;

    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      entities: [
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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    attachmentsRepo = dataSource.getRepository(Attachment);
    tombstonesRepo = dataSource.getRepository(SyncTombstone);

    service = new AttachmentsService(attachmentsRepo, tombstonesRepo);
  });

  afterEach(async () => {
    await dataSource.destroy();
    try {
      await fs.rm(testUploadsDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('dovrebbe trovare un allegato per id con findById', async () => {
    const att = await attachmentsRepo.save({
      id: 'test-att-1',
      userId: 'user-1',
      fileName: 'test.webp',
      originalName: 'test.jpg',
      mimeType: 'image/webp',
      size: 1024,
      path: '/api/attachments/file/test.webp',
      previewPath: '/api/attachments/file/previews/preview_test.webp',
      sortOrder: 0,
    });

    const found = await service.findById('test-att-1');
    assert.equal(found.id, att.id);
    assert.equal(found.fileName, 'test.webp');
  });

  it('dovrebbe sollevare NotFoundException se findById non trova l allegato', async () => {
    await assert.rejects(async () => {
      await service.findById('non-existent');
    }, /Attachment non-existent not found/);
  });

  it('dovrebbe restituire il previewFilePath corretto tramite getPreviewFilePathById', async () => {
    const previewDir = path.join(testUploadsDir, 'previews');
    await fs.mkdir(previewDir, { recursive: true });
    const dummyPreview = path.join(previewDir, 'preview_test.webp');
    await fs.writeFile(dummyPreview, 'dummy content');

    await attachmentsRepo.save({
      id: 'test-att-preview',
      userId: 'user-1',
      fileName: 'test.webp',
      originalName: 'test.jpg',
      mimeType: 'image/webp',
      size: 1024,
      path: '/api/attachments/file/test.webp',
      previewPath: '/api/attachments/file/previews/preview_test.webp',
      sortOrder: 0,
    });

    const res = await service.getPreviewFilePathById('test-att-preview');
    assert.equal(res.filePath, dummyPreview);
    assert.equal(res.mimeType, 'image/webp');
  });

  it('dovrebbe fare fallback sul file principale se il file preview non esiste su disco', async () => {
    await fs.mkdir(testUploadsDir, { recursive: true });
    const mainFile = path.join(testUploadsDir, 'main.webp');
    await fs.writeFile(mainFile, 'main dummy content');

    await attachmentsRepo.save({
      id: 'test-att-fallback',
      userId: 'user-1',
      fileName: 'main.webp',
      originalName: 'main.jpg',
      mimeType: 'image/webp',
      size: 2048,
      path: '/api/attachments/file/main.webp',
      previewPath: '/api/attachments/file/previews/missing_preview.webp',
      sortOrder: 0,
    });

    const res = await service.getPreviewFilePathById('test-att-fallback');
    assert.equal(res.filePath, mainFile);
  });
});
