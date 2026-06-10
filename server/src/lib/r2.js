// Cloudflare R2 (S3-compatible) — signed URLs for receipt upload/download
// (spec 2.4 / 7.4). Optional: endpoints report 503 if not configured.
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function client() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
}

export const r2Configured = () =>
  Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

export async function signedUploadUrl(key, contentType) {
  const s3 = client();
  if (!s3) throw Object.assign(new Error('File storage (R2) is not configured'), { status: 503 });
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: 600 });
}

export async function signedDownloadUrl(key) {
  const s3 = client();
  if (!s3) throw Object.assign(new Error('File storage (R2) is not configured'), { status: 503 });
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 600 });
}

export async function putObject(key, body, contentType) {
  const s3 = client();
  if (!s3) return null;
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return key;
}
