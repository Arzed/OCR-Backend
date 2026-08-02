import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface EKtpExtractionResponse {
  isValidKtp: boolean;
  detectedCardType: 'E_KTP' | 'SIM' | 'NPWP' | 'CREDIT_CARD' | 'PASSPORT' | 'UNKNOWN';
  documentType?: string;
  validationMessage: string;
  confidenceScore: number;
  isDigitalScreen?: boolean;
  isPhotoOfPhoto?: boolean;
  isEdited?: boolean;
  isTampered?: boolean;
  isExpired?: boolean;
  ktpData?: {
    nik?: string;
    nama?: string;
    tempatLahir?: string;
    tanggalLahir?: string;
    jenisKelamin?: string;
    golonganDarah?: string;
    alamat?: string;
    rtRw?: string;
    kelDesa?: string;
    kecamatan?: string;
    agama?: string;
    statusPerkawinan?: string;
    pekerjaan?: string;
    kewarganegaraan?: string;
    berlakuHingga?: string;
    masaBerlaku?: string;
    documentType?: string;
    isDigitalScreen?: boolean;
    isPhotoOfPhoto?: boolean;
    isEdited?: boolean;
    isTampered?: boolean;
    isExpired?: boolean;
  };
  tokensUsed?: number;
}

@Injectable()
export class OpenAiService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY', ''),
    });
  }

  async extractAndValidateKtp(imageUrl: string): Promise<EKtpExtractionResponse> {
    const systemPrompt = `
You are an expert AI document verification, liveness/anti-spoofing detection, and OCR system specializing in Indonesian Identity Cards (E-KTP).

Your task:
1. Document Identification: Determine if the card in the image is an Indonesian E-KTP, SIM (Surat Izin Mengemudi / Driver's License), NPWP (Tax ID), Passport, Credit Card, or UNKNOWN.
2. Anti-Spoofing & Authenticity Checks:
   - "isDigitalScreen": Detect if the photo was taken off a digital screen (laptop, monitor, phone screen showing pixel grid moire or screen glare).
   - "isPhotoOfPhoto": Detect if the photo is a re-photo of a printed paper photo or photocopy.
   - "isEdited": Detect if the text or photo has digital manipulation or photoshop edits.
   - "isExpired": Check if "berlakuHingga" / "masaBerlaku" explicitly indicates EXPIRED / TIDAK BERLAKU status. Note: e-KTPs with "SEUMUR HIDUP" or issued after 2011 are valid for life unless explicitly marked EXPIRED.
3. If it IS a valid physical E-KTP, extract all fields with 100% accuracy.

Rules for "isValidKtp":
- Must be true ONLY IF "detectedCardType" is "E_KTP", NIK is 16 digits, "isDigitalScreen" is false, "isPhotoOfPhoto" is false, "isEdited" is false, and "isExpired" is false.
- Otherwise, "isValidKtp" MUST be false.

Return ONLY valid JSON matching this schema:
{
  "isValidKtp": boolean,
  "detectedCardType": "E_KTP" | "SIM" | "NPWP" | "CREDIT_CARD" | "PASSPORT" | "UNKNOWN",
  "documentType": string,
  "validationMessage": string (Clear explanation in Indonesian),
  "confidenceScore": number (0.0 to 1.0),
  "isDigitalScreen": boolean,
  "isPhotoOfPhoto": boolean,
  "isEdited": boolean,
  "isTampered": boolean,
  "isExpired": boolean,
  "ktpData": {
    "nik": string (16 digits or null),
    "nama": string or null,
    "tempatLahir": string or null,
    "tanggalLahir": string or null (DD-MM-YYYY),
    "jenisKelamin": "LAKI-LAKI" | "PEREMPUAN" | null,
    "golonganDarah": string or null,
    "alamat": string or null,
    "rtRw": string or null,
    "kelDesa": string or null,
    "kecamatan": string or null,
    "agama": string or null,
    "statusPerkawinan": string or null,
    "pekerjaan": string or null,
    "kewarganegaraan": string or null,
    "berlakuHingga": string or null,
    "masaBerlaku": string or null,
    "documentType": string,
    "isDigitalScreen": boolean,
    "isPhotoOfPhoto": boolean,
    "isEdited": boolean,
    "isTampered": boolean,
    "isExpired": boolean
  }
}
`;

    try {
      const imagePayloadUrl = imageUrl.startsWith('http') || imageUrl.startsWith('data:') 
        ? imageUrl 
        : `data:image/jpeg;base64,${imageUrl}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Validate if this image is an authentic physical E-KTP, perform anti-spoofing checks (digital screen/photo of photo/editing), and extract all fields with maximum precision.' },
              { 
                type: 'image_url', 
                image_url: { 
                  url: imagePayloadUrl,
                  detail: 'high'
                } 
              },
            ],
          },
        ],
        temperature: 0.0,
      });

      const rawJsonStr = response.choices[0]?.message?.content || '{}';
      const parsedData = JSON.parse(rawJsonStr) as EKtpExtractionResponse;
      parsedData.tokensUsed = response.usage?.total_tokens || 0;

      // Post-processing NIK Sanitizer to fix common OCR character confusions
      if (parsedData.ktpData?.nik) {
        parsedData.ktpData.nik = this.sanitizeNik(parsedData.ktpData.nik);
      }

      return parsedData;
    } catch (error) {
      throw new InternalServerErrorException(`OpenAI Vision extraction failed: ${error.message}`);
    }
  }

  private sanitizeNik(nik: string): string {
    const cleaned = nik
      .replace(/[O|o|D]/g, '0')
      .replace(/[I|l|L|i]/g, '1')
      .replace(/[Z|z]/g, '2')
      .replace(/[E|e]/g, '3')
      .replace(/[A|a]/g, '4')
      .replace(/[S|s]/g, '5')
      .replace(/[G|g]/g, '6')
      .replace(/[T|t]/g, '7')
      .replace(/[B]/g, '8')
      .replace(/\D/g, ''); // Keep only numeric digits

    return cleaned.length === 16 ? cleaned : nik;
  }
}
