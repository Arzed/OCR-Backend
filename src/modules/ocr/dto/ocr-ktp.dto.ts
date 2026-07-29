import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
