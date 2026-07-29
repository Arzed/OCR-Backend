import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { StorageModule } from '../storage/storage.module';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [StorageModule, OpenAiModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
