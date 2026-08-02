import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface EKtpExtractionResponse {
  isValidKtp: boolean;
  detectedCardType: 'E_KTP' | 'SIM' | 'NPWP' | 'CREDIT_CARD' | 'PASSPORT' | 'UNKNOWN';
  validationMessage: string;
  isDigitalScreen?: boolean;
  isPhotoOfPhoto?: boolean;
  isEdited?: boolean;
  fraudType?: 'DIGITAL_SCREEN' | 'PHOTO_OF_PHOTO' | 'EDITED' | 'INVALID_CARD' | 'NONE';
  confidenceScore: number;
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
You are an expert AI document verification, anti-spoofing fraud detection, and OCR system specializing in Indonesian Identity Cards (E-KTP).

Your task:
1. Verify if the provided image is an authentic, physical Indonesian E-KTP (Electronic KTP).
2. Detect if the document is NOT an E-KTP (e.g. SIM / Driver's License, NPWP, Credit Card, Passport, or arbitrary document).
3. Anti-Spoofing & Fraud Detection:
   - Check if the photo was captured from a DIGITAL SCREEN (monitor, laptop, or smartphone screen showing moiré patterns, bezel edges, or pixel grid). Set "isDigitalScreen": true if detected.
   - Check if the photo is a PHOTO-OF-PHOTO / photocopy printout. Set "isPhotoOfPhoto": true if detected.
   - Check if the card shows signs of DIGITAL EDITING / manipulation. Set "isEdited": true if detected.
4. If it IS an authentic E-KTP, extract all visible text fields with extreme precision into JSON format.

CRITICAL INSTRUCTIONS FOR MAXIMUM ACCURACY:
- NIK: Must be EXACTLY 16 digits. Pay extreme attention to distinguishing numbers from letters (e.g. '0' vs 'O'/'D', '1' vs 'I'/'l', '8' vs 'B', '5' vs 'S', '3' vs 'E').
- NIK Date-of-Birth Cross Check: In Indonesian NIK, digits 7-8 represent Day, 9-10 represent Month, and 11-12 represent Year of birth. For females, 40 is added to the Day (e.g., day 55 means female born on 15th). Use this rule to verify and rectify any ambiguous NIK digits against "tanggalLahir".
- Text Standardization: Clean up minor noise characters, normalize all text to uppercase (e.g. "ISLAM", "KAWIN", "WNI").
- RT/RW & Kel/Desa: Extract exact codes without dropping trailing/leading numbers.
- If a field is blurred, damaged, or unreadable, set its value to null rather than guessing incorrect characters.

Return ONLY valid JSON matching this schema:
{
  "isValidKtp": boolean,
  "detectedCardType": "E_KTP" | "SIM" | "NPWP" | "CREDIT_CARD" | "PASSPORT" | "UNKNOWN",
  "isDigitalScreen": boolean,
  "isPhotoOfPhoto": boolean,
  "isEdited": boolean,
  "fraudType": "DIGITAL_SCREEN" | "PHOTO_OF_PHOTO" | "EDITED" | "INVALID_CARD" | "NONE",
  "validationMessage": "Clear explanation in Indonesian",
  "confidenceScore": number (0.0 to 1.0),
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
    "berlakuHingga": string or null
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
              { type: 'text', text: 'Validate if this image is an E-KTP and extract all fields with maximum precision.' },
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
