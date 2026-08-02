import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StorageModule } from './modules/storage/storage.module';
import { OpenAiModule } from './modules/openai/openai.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { AppUpdateModule } from './modules/app-update/app-update.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    StorageModule,
    OpenAiModule,
    OcrModule,
    AppUpdateModule,
  ],
})
export class AppModule {}
