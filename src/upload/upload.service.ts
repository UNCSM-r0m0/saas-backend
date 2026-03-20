import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadImageResponseDto, ImageVariantsDto } from './dto/upload-image.dto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly cfAccountId: string;
  private readonly cfApiToken: string;
  private readonly cfAccountHash: string;
  private readonly maxFileSize: number;
  private readonly allowedTypes: string[];

  constructor(private readonly configService: ConfigService) {
    this.cfAccountId = this.configService.get<string>('CF_ACCOUNT_ID', '');
    this.cfApiToken = this.configService.get<string>('CF_API_TOKEN', '');
    this.cfAccountHash = this.configService.get<string>('CF_IMAGES_ACCOUNT_HASH', '');
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE_MB', 10) * 1024 * 1024;
    this.allowedTypes = this.configService.get<string>('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif,image/webp')
      .split(',')
      .map(t => t.trim());
  }

  /**
   * Verifica si Cloudflare Images está configurado
   */
  isConfigured(): boolean {
    return !!(this.cfAccountId && this.cfApiToken && this.cfAccountHash);
  }

  /**
   * Valida el archivo antes de subir
   */
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar tamaño
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `Archivo demasiado grande. Máximo: ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Validar tipo
    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Permitidos: ${this.allowedTypes.join(', ')}`
      );
    }
  }

  /**
   * Sube una imagen a Cloudflare Images
   */
  async uploadImage(
    file: Express.Multer.File,
    userId?: string,
    metadata?: Record<string, string>,
  ): Promise<UploadImageResponseDto> {
    // Si no está configurado Cloudflare, usar modo local/simulado
    if (!this.isConfigured()) {
      this.logger.warn('Cloudflare Images no configurado. Usando modo simulado.');
      return this.createMockResponse(file, userId);
    }

    try {
      const formData = new FormData();
      
      // Convertir Buffer a Blob
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      
      // Metadata opcional
      if (userId) {
        formData.append('metadata', JSON.stringify({ userId, ...metadata }));
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/images/v1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfApiToken}`,
          },
          body: formData as any,
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cloudflare API error: ${error}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || 'Error desconocido');
      }

      const imageId = result.result.id;
      const variants = this.buildImageUrls(imageId);

      this.logger.log(`Imagen subida exitosamente: ${imageId} (usuario: ${userId || 'anónimo'})`);

      return {
        id: imageId,
        url: variants.public,
        thumbnailUrl: variants.thumbnail,
        mediumUrl: variants.medium,
        variants,
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error subiendo imagen a Cloudflare:', error.message);
      throw new InternalServerErrorException('Error al subir la imagen');
    }
  }

  /**
   * Obtiene las URLs de las variantes de una imagen
   */
  getImageUrls(imageId: string): ImageVariantsDto {
    return this.buildImageUrls(imageId);
  }

  /**
   * Elimina una imagen de Cloudflare
   */
  async deleteImage(imageId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`Modo simulado: eliminando imagen ${imageId}`);
      return true;
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/images/v1/${imageId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.cfApiToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Error eliminando imagen: ${response.statusText}`);
      }

      this.logger.log(`Imagen eliminada: ${imageId}`);
      return true;
    } catch (error) {
      this.logger.error('Error eliminando imagen:', error.message);
      throw new InternalServerErrorException('Error al eliminar la imagen');
    }
  }

  /**
   * Construye las URLs de las variantes de una imagen
   */
  private buildImageUrls(imageId: string): ImageVariantsDto {
    const baseUrl = `https://imagedelivery.net/${this.cfAccountHash}/${imageId}`;
    return {
      public: `${baseUrl}/public`,
      thumbnail: `${baseUrl}/thumbnail`,
      medium: `${baseUrl}/medium`,
      large: `${baseUrl}/large`,
    };
  }

  /**
   * Crea una respuesta simulada para modo local
   */
  private createMockResponse(
    file: Express.Multer.File,
    userId?: string,
  ): UploadImageResponseDto {
    const mockId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`[MOCK] Imagen procesada: ${mockId} (usuario: ${userId || 'anónimo'})`);

    return {
      id: mockId,
      url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      thumbnailUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      mediumUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      variants: {
        public: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        thumbnail: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        medium: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      },
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
  }
}
