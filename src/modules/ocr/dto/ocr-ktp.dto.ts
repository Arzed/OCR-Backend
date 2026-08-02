import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class RequestPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}

export class ExtractKtpDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsString()
  @IsOptional()
  directImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  detectScreen?: boolean;

  @IsBoolean()
  @IsOptional()
  detectManipulation?: boolean;

  @IsBoolean()
  @IsOptional()
  validateExpiry?: boolean;

  @IsBoolean()
  @IsOptional()
  isLiveCapture?: boolean;

  @IsString()
  @IsOptional()
  sourceType?: string;

  @IsString()
  @IsOptional()
  captureTimestamp?: string;

  @IsString()
  @IsOptional()
  appSignature?: string;
}
