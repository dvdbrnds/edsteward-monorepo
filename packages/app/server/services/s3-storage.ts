import { log } from '../vite';

/**
 * Check if S3 is available (AWS deployment with credentials or IAM role).
 * On Coolify deployments, S3 is disabled -- files are stored in the database
 * `file_storage` table via storage.ts instead.
 */
function isS3Available(): boolean {
  if (process.env.DEPLOYMENT_MODE === 'coolify') {
    return false;
  }
  if (process.env.S3_BUCKET_NAME || process.env.AWS_ACCESS_KEY_ID || process.env.ECS_CONTAINER_METADATA_URI) {
    return true;
  }
  return false;
}

export class S3StorageService {
  private s3Client: any;
  private bucketName: string;
  private available: boolean;

  constructor() {
    this.available = isS3Available();
    this.bucketName = process.env.S3_BUCKET_NAME || 'edsteward-uploads';
    
    if (this.available) {
      this.initS3Client();
    } else {
      log('S3 storage disabled (DEPLOYMENT_MODE=coolify or no AWS credentials). Files use database storage.');
    }
  }

  private async initS3Client() {
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: process.env.AWS_ACCESS_KEY_ID ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        } : undefined,
      });
    } catch (error) {
      log(`S3 client initialization failed: ${error}. Falling back to database storage.`);
      this.available = false;
    }
  }

  isEnabled(): boolean {
    return this.available;
  }

  async uploadFile(
    key: string, 
    buffer: Buffer, 
    contentType: string,
    tenantId?: string
  ): Promise<{ url: string; key: string }> {
    if (!this.available) {
      log('S3 upload skipped (not available). File should be stored in database.');
      return { url: '', key };
    }
    
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const finalKey = tenantId ? `tenants/${tenantId}/${key}` : key;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          tenantId: tenantId || 'shared',
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      
      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${finalKey}`;
      
      log(`File uploaded to S3: ${finalKey}`);
      
      return { url, key: finalKey };
    } catch (error) {
      log(`S3 upload error: ${error}`);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.available) {
      return '';
    }

    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      log(`S3 signed URL error: ${error}`);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.available) {
      return;
    }

    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      log(`File deleted from S3: ${key}`);
    } catch (error) {
      log(`S3 deletion error: ${error}`);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    if (!this.available) {
      return false;
    }

    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

export const s3Storage = new S3StorageService(); 