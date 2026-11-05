import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BearerJwtGuard } from '../common/auth/bearer-jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthUser } from '../common/auth/auth.types';
import { AttachmentsService } from '../services/attachments.service';

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseGuards(BearerJwtGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadFile,
    @Body('plantId') plantId?: string,
    @Body('spaceId') spaceId?: string,
    @Body('roomId') roomId?: string,
    @Body('sortOrder') sortOrder?: string,
  ) {
    if (!file) {
      throw new NotFoundException('Nessun file fornito per il caricamento');
    }

    return this.attachmentsService.saveFile(
      user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        plantId,
        spaceId,
        roomId,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      },
    );
  }

  @Get('file/previews/:filename')
  async getPreviewFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.attachmentsService.getFilePath(`previews/${filename}`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  @Get('file/:filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.attachmentsService.getFilePath(filename);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  @Get(':id/preview')
  async getPreviewById(@Param('id') id: string, @Res() res: Response) {
    const { filePath, mimeType } = await this.attachmentsService.getPreviewFilePathById(id);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    return res.sendFile(filePath);
  }

  @Get(':id')
  async getFileById(@Param('id') id: string, @Res() res: Response) {
    const { filePath, mimeType } = await this.attachmentsService.getFilePathById(id);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    return res.sendFile(filePath);
  }

  @Delete(':id')
  @UseGuards(BearerJwtGuard)
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.attachmentsService.delete(user.id, id);
    return { success: true };
  }
}
