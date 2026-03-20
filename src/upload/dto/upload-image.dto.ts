export class UploadImageResponseDto {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  variants: {
    public: string;
    thumbnail: string;
    medium: string;
    large?: string;
  };
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export class ImageVariantsDto {
  public: string;
  thumbnail: string;
  medium: string;
  large?: string;
}

export class ImageMetadataDto {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
  userId?: string;
}
