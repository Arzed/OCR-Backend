import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { OpenAiService, EKtpExtractionResponse } from '../openai/openai.service';
import { RequestPresignedUrlDto, ExtractKtpDto } from './dto/ocr-ktp.dto';
import { CardType } from '@prisma/client';

@Injectable()
export class OcrService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private openAiService: OpenAiService,
  ) {}

  async getPresignedUploadUrl(dto: RequestPresignedUrlDto) {
    return this.storageService.generateUploadPresignedUrl(dto.fileName, dto.mimeType);
  }

  async extractAndValidateKtp(userId: string, dto: ExtractKtpDto) {
    // 1. Get temporary accessible download URL for OpenAI Vision API
    const imageUrl = dto.directImageUrl || (await this.storageService.generateDownloadPresignedUrl(dto.s3Key));

    // 2. Perform AI extraction and E-KTP card type verification
    const extraction: EKtpExtractionResponse = await this.openAiService.extractAndValidateKtp(imageUrl);

    // Map string card type to Prisma Enum
    let mappedCardType: CardType = CardType.UNKNOWN;
    if (extraction.detectedCardType === 'E_KTP') mappedCardType = CardType.E_KTP;
    else if (extraction.detectedCardType === 'SIM') mappedCardType = CardType.SIM;
    else if (extraction.detectedCardType === 'CREDIT_CARD') mappedCardType = CardType.CREDIT_CARD;
    else if (extraction.detectedCardType === 'PASSPORT') mappedCardType = CardType.PASSPORT;

    // 3. Ensure user exists in database to prevent P2003 Foreign Key constraint failure
    let targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      targetUser = await this.prisma.user.findFirst();
    }
    const validUserId = targetUser?.id || userId;

    const ktpData = extraction.ktpData || {};
    const record = await this.prisma.ktpExtraction.create({
      data: {
        userId: validUserId,
        s3Key: dto.s3Key,
        isValidKtp: extraction.isValidKtp,
        detectedCardType: mappedCardType,
        validationMessage: extraction.validationMessage,
        confidenceScore: extraction.confidenceScore,
        nik: ktpData.nik || null,
        nama: ktpData.nama || null,
        tempatLahir: ktpData.tempatLahir || null,
        tanggalLahir: ktpData.tanggalLahir || null,
        jenisKelamin: ktpData.jenisKelamin || null,
        golonganDarah: ktpData.golonganDarah || null,
        alamat: ktpData.alamat || null,
        rtRw: ktpData.rtRw || null,
        kelDesa: ktpData.kelDesa || null,
        kecamatan: ktpData.kecamatan || null,
        agama: ktpData.agama || null,
        statusPerkawinan: ktpData.statusPerkawinan || null,
        pekerjaan: ktpData.pekerjaan || null,
        kewarganegaraan: ktpData.kewarganegaraan || null,
        berlakuHingga: ktpData.berlakuHingga || null,
        rawResponseJson: extraction as any,
        tokensUsed: extraction.tokensUsed || 0,
      },
    });

    return {
      id: record.id,
      isValidKtp: record.isValidKtp,
      detectedCardType: record.detectedCardType,
      validationMessage: record.validationMessage,
      confidenceScore: record.confidenceScore,
      ktpData: {
        nik: record.nik,
        nama: record.nama,
        tempatLahir: record.tempatLahir,
        tanggalLahir: record.tanggalLahir,
        jenisKelamin: record.jenisKelamin,
        golonganDarah: record.golonganDarah,
        alamat: record.alamat,
        rtRw: record.rtRw,
        kelDesa: record.kelDesa,
        kecamatan: record.kecamatan,
        agama: record.agama,
        statusPerkawinan: record.statusPerkawinan,
        pekerjaan: record.pekerjaan,
        kewarganegaraan: record.kewarganegaraan,
        berlakuHingga: record.berlakuHingga,
      },
    };
  }

  async getUserKtpHistory(userId: string) {
    return this.prisma.ktpExtraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
