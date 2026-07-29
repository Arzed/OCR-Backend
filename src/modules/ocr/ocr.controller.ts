import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { RequestPresignedUrlDto, ExtractKtpDto } from './dto/ocr-ktp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('presigned-url')
  async getPresignedUploadUrl(@Body() dto: RequestPresignedUrlDto) {
    const data = await this.ocrService.getPresignedUploadUrl(dto);
    return { success: true, data };
  }

  @Post('extract-ktp')
  async extractKtp(@Request() req, @Body() dto: ExtractKtpDto) {
    const data = await this.ocrService.extractAndValidateKtp(req.user.userId, dto);
    return { success: true, data };
  }

  @Get('history')
  async getHistory(@Request() req) {
    const data = await this.ocrService.getUserKtpHistory(req.user.userId);
    return { success: true, data };
  }
}
