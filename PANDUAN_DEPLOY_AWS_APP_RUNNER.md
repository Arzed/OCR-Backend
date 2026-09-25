# Panduan Lengkap Deploy Backend Mobile OCR ke AWS App Runner

Dokumen ini menjelaskan langkah demi langkah untuk men-deploy backend NestJS E-KTP OCR (`Mobile_OCR_Version/backend`) ke **AWS App Runner** agar mendapatkan URL endpoint HTTPS production dengan auto-scaling otomatis.

---

## 1. Persiapan yang Sudah Disediakan di Project
Backend ini sudah dikonfigurasi siap pakai:
1. **`Dockerfile` multi-stage**: Memakai Node 20 Slim + pnpm + Prisma pre-generate + non-root security.
2. **`schema.prisma`**: Sudah ditambahkan `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`.
3. **`src/main.ts`**: Sudah disetel untuk mendengarkan port container pada host `0.0.0.0`.

---

## 2. Pilihan Alur Deployment ke AWS App Runner

Ada dua cara mudah:
- **Cara 1 (Paling Simpel): Sambungkan langsung Repository GitHub ke App Runner** (AWS yang mengompilasi Dockerfile otomatis).
- **Cara 2: Build Docker Image secara lokal lalu push ke Amazon ECR**.

---

### Cara 1: Menggunakan GitHub Repository (Rekomendasi)

1. **Push folder backend ke GitHub**:
   Pastikan kode backend sudah berada di repositori Git Anda (misal branch `main`).

2. **Buka AWS Console**:
   - Masuk ke layanan **AWS App Runner**.
   - Pastikan region berada di **ap-southeast-1 (Singapore)** (agar dekat dengan database Neon dan bucket S3).
   - Klik **Create an App Runner service**.

3. **Langkah 1: Source and deployment**:
   - **Source type**: Pilih **Source code repository**.
   - Hubungkan akun GitHub Anda (*Connect new account*).
   - Pilih **Repository** dan **Branch** (misal `main`).
   - Di bagian **Deployment settings**:
     - Pilih **Automatic** (setiap push ke Git akan auto-deploy).
   - Klik **Next**.

4. **Langkah 2: Configure build**:
   - **Configuration file**: Pilih **Use a configuration file** ATAU **Configure all settings here**:
     - Runtime: **Node.js 20** ATAU jika memilih Docker:
       - Build provider: **Dockerfile**.
       - Dockerfile path: `./Dockerfile`.
   - Klik **Next**.

5. **Langkah 3: Configure service**:
   - **Service name**: `daro-ocr-backend`
   - **Virtual CPU & Memory**: `1 vCPU, 2 GB` (sangat cukup dan hemat biaya).
   - **Port**: `3000`
   - **Environment variables** (tambahkan variabel dari file `.env`):
     | Key | Contoh Value |
     |---|---|
     | `PORT` | `3000` |
     | `DATABASE_URL` | `postgresql://neondb_owner:***@ep-falling-tree-azgyjtd8-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require` |
     | `OPENAI_API_KEY` | `sk-proj-***` |
     | `AWS_REGION` | `ap-southeast-1` |
     | `AWS_S3_BUCKET_NAME` | `ektp-verification` |
     | `AWS_ACCESS_KEY_ID` | `WHBEHWV772ZO716LNBH2` |
     | `AWS_SECRET_ACCESS_KEY` | `jGjt52f0AhTTL7tf9BXSBEMsWxB8RLRZD0tL8hsw` |
     | `JWT_SECRET` | `z9sGiZ6erR5FWHNEGtaVcCS70CD6F7akVcqM4N1eKO4=` |
     | `JWT_EXPIRES_IN` | `7d` |

6. **Langkah 4: Review and create**:
   - Klik **Create & deploy**.
   - Tunggu status berubah menjadi **Running** (sekitar 3-5 menit).

---

### Cara 2: Build & Push Image ke Amazon ECR

Jika Anda ingin membangun image Docker secara mandiri di komputer Anda:

```bash
# 1. Login ke AWS ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com

# 2. Buat repository ECR (jika belum ada)
aws ecr create-repository --repository-name daro-ocr-backend --region ap-southeast-1

# 3. Build image Docker
docker build -t daro-ocr-backend .

# 4. Tag dan Push ke ECR
docker tag daro-ocr-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/daro-ocr-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/daro-ocr-backend:latest

# 5. Di AWS App Runner, pilih Container Registry (Amazon ECR) dan pilih image tersebut.
```

---

## 3. Menghubungkan URL ke Aplikasi Android

Setelah service berjalan, AWS App Runner akan memberikan domain publik:
Contoh:
```text
https://abcdefghij.ap-southeast-1.awsapprunner.com
```

Buka file **`local.properties`** pada project Android (`Mobile_OCR_Version/Daro_Lab_KTP_Image_Scanner/local.properties`), lalu perbarui:
```properties
ocrUrl=https://abcdefghij.ap-southeast-1.awsapprunner.com/api/v1
```

Aplikasi mobile OCR sekarang akan mengirimkan gambar e-KTP langsung ke AWS App Runner Anda!
