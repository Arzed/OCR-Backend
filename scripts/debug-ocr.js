/**
 * OCR Debug Script for NestJS Backend & OpenAI Vision API
 * (Simulates Postman API requests using KTP-front.jpg)
 *
 * Usage:
 *   node scripts/debug-ocr.js [path/to/image.jpg] [server_url]
 *
 * Example:
 *   pnpm debug:ocr
 *   node scripts/debug-ocr.js ./scripts/KTP-front.jpg http://localhost:3000/api/v1/ocr/extract-ktp
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const defaultTargetUrl = process.env.OCR_URL || 'http://localhost:3000/api/v1/ocr/extract-ktp';
const defaultKtpPath = path.join(__dirname, 'KTP-front.jpg');

const imageArg = process.argv[2] || (fs.existsSync(defaultKtpPath) ? defaultKtpPath : null);
const customUrlArg = process.argv[3] || defaultTargetUrl;

console.log('\n==================================================');
console.log('🔍 OCR BACKEND DEBUGGER & ANTI-SPOOFING TESTER (POSTMAN SIMULATION)');
console.log('==================================================');

// 1. Prepare Base64 Image Payload from KTP-front.jpg or argument
let imageBase64 = '';
let imageSourceDescription = '';

if (imageArg && fs.existsSync(imageArg)) {
  const fileBytes = fs.readFileSync(imageArg);
  const ext = path.extname(imageArg).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  imageBase64 = `data:${mimeType};base64,` + fileBytes.toString('base64');
  imageSourceDescription = `File: ${imageArg} (${(fileBytes.length / 1024).toFixed(1)} KB)`;
} else {
  // Fallback sample pixel if file is missing
  const sampleBase64Pixel =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  imageBase64 = 'data:image/jpeg;base64,' + sampleBase64Pixel;
  imageSourceDescription = 'Sample fallback pixel';
}

console.log(`📡 Target Endpoint : ${customUrlArg}`);
console.log(`🖼️ Image Source    : ${imageSourceDescription}`);
console.log(`📦 Payload Size    : ${(imageBase64.length / 1024).toFixed(1)} KB Base64`);
console.log('==================================================\n');

const payloadData = JSON.stringify({
  s3Key: 'postman-debug-upload',
  directImageUrl: imageBase64,
  detectScreen: true,
  detectManipulation: true,
  validateExpiry: true,
});

const urlObj = new URL(customUrlArg);
const client = urlObj.protocol === 'https:' ? https : http;

const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadData),
  },
  timeout: 45000,
};

console.log('🚀 Sending Postman-Equivalent OCR Extraction Request...');
const startTime = Date.now();

const req = client.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Response Time   : ${duration} ms`);
    console.log(`📊 HTTP Status     : ${res.statusCode} ${res.statusMessage}\n`);

    try {
      const json = JSON.parse(responseData);
      console.log('📄 FULL BACKEND JSON RESPONSE:');
      console.log('--------------------------------------------------');
      console.log(JSON.stringify(json, null, 2));
      console.log('--------------------------------------------------\n');

      const data = json.data || json;
      const ktpData = data.ktpData || {};

      console.log('📋 DIAGNOSTIC RESULTS SUMMARY:');
      console.log(` • Valid e-KTP         : ${data.isValidKtp ? '✅ YES' : '❌ NO'}`);
      console.log(` • Card Classification : ${data.detectedCardType || data.cardType || 'UNKNOWN'}`);
      console.log(` • NIK                 : ${ktpData.nik || data.nik || 'Not detected'}`);
      console.log(` • Nama Lengkap        : ${ktpData.namaLengkap || ktpData.nama || data.nama || 'Not detected'}`);
      console.log(` • Tempat, Tgl Lahir   : ${ktpData.tempatTanggalLahir || data.tempatTanggalLahir || 'Not detected'}`);
      console.log(` • Jenis Kelamin       : ${ktpData.jenisKelamin || data.jenisKelamin || 'Not detected'}`);
      console.log(` • Masa Berlaku        : ${ktpData.masaBerlaku || ktpData.berlakuHingga || 'SEUMUR HIDUP'}`);
      console.log(' --- Anti-Spoofing Flags ---');
      console.log(` • Digital Screen      : ${data.isDigitalScreen ? '⚠️ TRUE (Screen Photo Detected)' : 'OK (Physical)'}`);
      console.log(` • Photo of Photo      : ${data.isPhotoOfPhoto ? '⚠️ TRUE (Re-photo Detected)' : 'OK (Original)'}`);
      console.log(` • Edited / Tampered   : ${data.isEdited || data.isTampered ? '⚠️ TRUE (Manipulated)' : 'OK (Unedited)'}`);
      console.log(` • Expired Status      : ${data.isExpired ? '⚠️ TRUE (Expired Card)' : 'OK (Active)'}`);
      console.log('==================================================\n');
    } catch (e) {
      console.error('❌ Failed to parse JSON response:');
      console.log(responseData);
    }
  });
});

req.on('error', (err) => {
  console.error('\n❌ HTTP Request Error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('👉 Tip: Make sure your NestJS backend server is running on ' + urlObj.host + ' (`pnpm start:dev`)');
  }
});

req.on('timeout', () => {
  req.destroy();
  console.error('\n❌ Request Timeout (Exceeded 45s)');
});

req.write(payloadData);
req.end();
