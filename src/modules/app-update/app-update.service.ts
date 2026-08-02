import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppUpdateService {
  constructor(private readonly configService: ConfigService) { }

  getApkDownloadUrl(): string {
    const bucket = this.configService.get<string>('S3_BUCKET', 'ektp-verification');
    const objectKey = 'daro-lab-mpos.apk';
    const endpoint = this.configService.get<string>('S3_ENDPOINT', 'https://is3.cloudhost.id').replace(/\/$/, '');
    return `${endpoint}/${bucket}/${objectKey}`;
  }

  getLatestVersionInfo(currentVersion?: string) {
    const latestVersion = '1.0.1';
    const latestVersionCode = 2;
    const downloadUrl = this.getApkDownloadUrl();

    // Check if client version is older than latestVersion
    const isClientOutdated = currentVersion ? currentVersion !== latestVersion : true;

    return {
      success: true,
      data: {
        latestVersion,
        latestVersionCode,
        currentVersion: currentVersion || '1.0.1',
        hasUpdate: isClientOutdated,
        downloadUrl,
        directDownloadUrl: '/api/v1/app/download-apk',
        releaseNotes: 'Fitur ekstraksi E-KTP AI, Validasi Anti-Spoofing, dan Peningkatan Performa Aplikasi.',
        isMandatory: false,
      },
    };
  }
}
