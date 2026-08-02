/**
 * Upload APK to S3-compatible Object Storage (https://is3.cloudhost.id)
 * Bucket: zone-mart
 * Object Key: daro-lab-mpos.apk
 *
 * Usage:
 *   pnpm upload:apk
 *   node scripts/upload-apk.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Locate built Android APK file
const possibleApkPaths = [
  path.join(__dirname, '..', '..', 'Daro_Lab_KTP_Image_Scanner', 'app', 'build', 'outputs', 'apk', 'debug', 'daro_lab.apk'),
  path.join(__dirname, '..', '..', 'Daro_Lab_KTP_Image_Scanner', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(__dirname, '..', '..', 'Daro_Lab_KTP_Image_Scanner', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.join(__dirname, '..', 'daro_lab.apk'),
];

let APK_PATH = possibleApkPaths.find((p) => fs.existsSync(p));

if (!APK_PATH) {
  APK_PATH = possibleApkPaths[0]; // fallback path for error message
}

const BUCKET_NAME = process.env.S3_BUCKET || 'ektp-verification';
const OBJECT_KEY = 'daro-lab-mpos.apk';

const s3 = new S3Client({
  region: 'ap-southeast-1', // required for AWS SDK compatibility
  endpoint: process.env.S3_ENDPOINT || 'https://is3.cloudhost.id',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'WHBEHWV772ZO716LNBH2',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'jGjt52f0AhTTL7tf9BXSBEMsWxB8RLRZD0tL8hsw',
  },
  forcePathStyle: true,
});

async function uploadAPK() {
  console.log('\n==================================================');
  console.log('🚀 DARO LAB MPOS - APK STORAGE UPLOADER');
  console.log('==================================================');
  console.log(`📁 Reading APK from : ${APK_PATH}`);

  if (!fs.existsSync(APK_PATH)) {
    console.error(`\n❌ Error: APK file not found at: ${APK_PATH}`);
    console.error('👉 Tip: Run `.\\gradlew.bat assembleDebug` in Daro_Lab_KTP_Image_Scanner first to generate the APK.');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(APK_PATH);
  const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`📦 File Size       : ${fileSizeMB} MB`);
  console.log(`☁️ Target Storage   : s3://${BUCKET_NAME}/${OBJECT_KEY}`);

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: OBJECT_KEY,
      Body: fileBuffer,
      ContentType: 'application/vnd.android.package-archive',
      ACL: 'public-read',
    });

    const result = await s3.send(command);
    console.log('\n==================================================');
    console.log('✅ UPLOAD BERHASIL!');
    console.log(`📊 HTTP Status Code : ${result.$metadata.httpStatusCode}`);
    console.log(`🔗 Public Download  : https://is3.cloudhost.id/${BUCKET_NAME}/${OBJECT_KEY}`);
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ Upload Gagal:', err.message);
    if (err.Code) console.error('Error Code:', err.Code);
    if (err.$response) console.error('HTTP Status:', err.$response.statusCode);
    process.exit(1);
  }
}

uploadAPK();
