import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface EKtpExtractionResponse {
  isValidKtp: boolean;
  detectedCardType: 'E_KTP' | 'SIM' | 'CREDIT_CARD' | 'PASSPORT' | 'UNKNOWN';
  validationMessage: string;
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
You are an expert AI document verification and OCR system specializing in Indonesian Identity Cards (E-KTP).

Your task:
1. Verify if the provided image is a valid Indonesian E-KTP (Electronic KTP).
2. Determine if the card is NOT an E-KTP (e.g. Driver's License / SIM, Credit Card, Passport, NPWP, Student ID, or arbitrary document).
3. If it IS an E-KTP, extract all visible text fields with maximum precision into JSON format.

Return ONLY valid JSON matching this schema:
{
  "isValidKtp": boolean,
  "detectedCardType": "E_KTP" | "SIM" | "CREDIT_CARD" | "PASSPORT" | "UNKNOWN",
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
              { type: 'text', text: 'Validate if this image is an E-KTP and extract its fields.' },
              { type: 'image_url', image_url: { url: imagePayloadUrl } },
            ],
          },
        ],
        temperature: 0.1,
      });

      const rawJsonStr = response.choices[0]?.message?.content || '{}';
      const parsedData = JSON.parse(rawJsonStr) as EKtpExtractionResponse;
      parsedData.tokensUsed = response.usage?.total_tokens || 0;

      return parsedData;
    } catch (error) {
      throw new InternalServerErrorException(`OpenAI Vision extraction failed: ${error.message}`);
    }
  }
}
