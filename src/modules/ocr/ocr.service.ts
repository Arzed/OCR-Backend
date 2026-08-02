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

  async extractAndValidateKtp(userId: string | null, dto: ExtractKtpDto) {
    // 1. Get temporary accessible download URL for OpenAI Vision API
    const imageUrl = dto.directImageUrl || (dto.s3Key ? await this.storageService.generateDownloadPresignedUrl(dto.s3Key) : '');

    // 2. Perform AI extraction, card type verification, and anti-spoofing checks
    const extraction: EKtpExtractionResponse = await this.openAiService.extractAndValidateKtp(imageUrl);

    // Map string card type to Prisma Enum
    let mappedCardType: CardType = CardType.UNKNOWN;
    if (extraction.detectedCardType === 'E_KTP') mappedCardType = CardType.E_KTP;
    else if (extraction.detectedCardType === 'SIM') mappedCardType = CardType.SIM;
    else if (extraction.detectedCardType === 'CREDIT_CARD') mappedCardType = CardType.CREDIT_CARD;
    else if (extraction.detectedCardType === 'PASSPORT') mappedCardType = CardType.PASSPORT;

    // 3. Save extraction result log into PostgreSQL Database if userId is provided
    const ktpData = extraction.ktpData || {};
    let recordId = 'temp-' + Date.now();
    if (userId) {
      const record = await this.prisma.ktpExtraction.create({
        data: {
          userId,
          s3Key: dto.s3Key || 'direct-upload',
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
          berlakuHingga: ktpData.berlakuHingga || ktpData.masaBerlaku || null,
          rawResponseJson: extraction as any,
          tokensUsed: extraction.tokensUsed || 0,
        },
      });
      recordId = record.id;
    }

    const tempatLahir = ktpData.tempatLahir || '';
    const tanggalLahir = ktpData.tanggalLahir || '';
    const tempatTanggalLahir = [tempatLahir, tanggalLahir].filter(Boolean).join(', ');
    const docType = extraction.detectedCardType || extraction.documentType || (extraction.isValidKtp ? 'E_KTP' : 'UNKNOWN');
    const masaBerlaku = ktpData.masaBerlaku || ktpData.berlakuHingga || 'SEUMUR HIDUP';

    const isDigitalScreen = extraction.isDigitalScreen ?? ktpData.isDigitalScreen ?? false;
    const isPhotoOfPhoto = extraction.isPhotoOfPhoto ?? ktpData.isPhotoOfPhoto ?? false;
    const isEdited = extraction.isEdited ?? ktpData.isEdited ?? false;
    const isTampered = extraction.isTampered ?? ktpData.isTampered ?? false;
    const isExpired = extraction.isExpired ?? ktpData.isExpired ?? false;

    // 4. Live Capture vs Postman / File Upload Security Check
    const isLiveCapture = dto.isLiveCapture === true && dto.sourceType === 'LIVE_CAMERA_CAPTURE';
    const finalIsValidKtp = extraction.isValidKtp && isLiveCapture;
    const finalValidationMessage = !isLiveCapture
      ? 'Pengunggahan ditolak: Foto e-KTP wajib diambil secara langsung (live camera capture) dari aplikasi mobile Daro Lab, bukan dikirim melalui Postman atau galeri file.'
      : extraction.validationMessage;

    return {
      id: recordId,
      isValidKtp: finalIsValidKtp,
      isLiveCapture,
      isUnauthorizedUpload: !isLiveCapture,
      detectedCardType: extraction.detectedCardType,
      documentType: docType,
      cardType: docType,
      validationMessage: finalValidationMessage,
      confidenceScore: extraction.confidenceScore,
      isDigitalScreen,
      isPhotoOfPhoto,
      isEdited,
      isTampered,
      isExpired,
      nik: ktpData.nik || '',
      nama: ktpData.nama || '',
      namaLengkap: ktpData.nama || '',
      tempatLahir: tempatLahir,
      tanggalLahir: tanggalLahir,
      tempatTanggalLahir: tempatTanggalLahir,
      jenisKelamin: ktpData.jenisKelamin || '',
      masaBerlaku: masaBerlaku,
      berlakuHingga: masaBerlaku,
      ktpData: {
        nik: ktpData.nik || '',
        nama: ktpData.nama || '',
        namaLengkap: ktpData.nama || '',
        tempatLahir: tempatLahir,
        tanggalLahir: tanggalLahir,
        tempatTanggalLahir: tempatTanggalLahir,
        jenisKelamin: ktpData.jenisKelamin || '',
        documentType: docType,
        cardType: docType,
        masaBerlaku: masaBerlaku,
        berlakuHingga: masaBerlaku,
        isDigitalScreen,
        isPhotoOfPhoto,
        isEdited,
        isTampered,
        isExpired,
        isLiveCapture,
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
