import { Controller, Get, Query, Res } from '@nestjs/common';
import { AppUpdateService } from './app-update.service';

@Controller('app')
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @Get('check-update')
  checkUpdate(@Query('currentVersion') currentVersion?: string) {
    return this.appUpdateService.getLatestVersionInfo(currentVersion);
  }

  @Get('download-apk')
  downloadApk(@Res() res: any) {
    const downloadUrl = this.appUpdateService.getApkDownloadUrl();
    return res.redirect(downloadUrl);
  }
}
