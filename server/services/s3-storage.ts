import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/environment';
import { log } from '../vite';

export class S3StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      } : undefined, // Use IAM role if credentials not provided
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME || 'regulatorytrackr-uploads';
  }

  async uploadFile(
    key: string, 
    buffer: Buffer, 
    contentType: string,
    tenantId?: string
  ): Promise<{ url: string; key: string }> {
    try {
      // Add tenant prefix to key for multi-tenant isolation
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
    try {
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
    try {
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
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const s3Storage = new S3StorageService(); 