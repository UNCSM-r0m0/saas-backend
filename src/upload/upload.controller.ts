import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadImageResponseDto } from './dto/upload-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThrottleUpload } from '../common/throttler/throttler.decorators';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Sube una imagen
   * POST /upload/image
   */
  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ThrottleUpload()
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Body('metadata') metadataJson?: string,
  ): Promise<UploadImageResponseDto> {
    const metadata = metadataJson ? JSON.parse(metadataJson) : undefined;
    return this.uploadService.uploadImage(file, userId, metadata);
  }

  /**
   * Obtiene las URLs de una imagen por ID
   * GET /upload/image/:id
   */
  @Get('image/:id')
  @HttpCode(HttpStatus.OK)
  getImageUrls(@Param('id') imageId: string) {
    const variants = this.uploadService.getImageUrls(imageId);
    return {
      id: imageId,
      variants,
    };
  }

  /**
   * Elimina una imagen
   * DELETE /upload/image/:id
   */
  @Delete('image/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @Param('id') imageId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.uploadService.deleteImage(imageId);
  }

  /**
   * Health check del servicio de upload
   * GET /upload/health
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      configured: this.uploadService.isConfigured(),
      message: this.uploadService.isConfigured()
        ? 'Cloudflare Images configurado'
        : 'Modo local/simulado (Cloudflare no configurado)',
    };
  }
}
