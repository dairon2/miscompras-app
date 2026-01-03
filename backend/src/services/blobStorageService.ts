import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import logger from './logger';

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'pdfs';

/**
 * Determine MIME type based on file extension
 */
const getMimeType = (filePath: string): string => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

let containerClient: ContainerClient | null = null;

/**
 * Initialize Azure Blob Storage client
 */
const initializeBlobClient = async (): Promise<ContainerClient | null> => {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
        logger.blob('Connection string not configured, using local storage');
        return null;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const client = blobServiceClient.getContainerClient(CONTAINER_NAME);

        // Create container if it doesn't exist
        const exists = await client.exists();
        if (!exists) {
            await client.create({ access: 'blob' }); // Public read access for blobs
            logger.blob('Created container:', CONTAINER_NAME);
        }

        logger.blob('Initialized successfully');
        return client;
    } catch (error) {
        logger.error('Blob Storage failed to initialize:', error);
        return null;
    }
};

/**
 * Upload a file to Azure Blob Storage
 * @param filePath - Local path to the file
 * @param blobName - Name for the blob in storage
 * @returns URL of the uploaded blob, or null if upload failed
 */
export const uploadToBlobStorage = async (filePath: string, blobName: string): Promise<string | null> => {
    try {
        // Initialize client if not already done
        if (!containerClient) {
            containerClient = await initializeBlobClient();
        }

        if (!containerClient) {
            logger.blob('Not available, skipping upload');
            return null;
        }

        // Determine content type based on file extension
        const contentType = getMimeType(filePath);
        logger.blob(`Uploading with content type: ${contentType}`);

        // Read file and upload
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const fileBuffer = fs.readFileSync(filePath);

        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        });

        const blobUrl = `https://miscomprasstorage.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;
        logger.blob('Uploaded successfully:', blobUrl);

        // Delete local file after successful upload
        try {
            fs.unlinkSync(filePath);
            logger.blob('Deleted local file:', filePath);
        } catch (deleteError) {
            logger.warn('Could not delete local file:', deleteError);
        }

        return blobUrl;
    } catch (error) {
        logger.error('Blob Storage upload failed:', error);
        return null;
    }
};

/**
 * Upload a buffer directly to Azure Blob Storage
 * @param buffer - File buffer
 * @param blobName - Name for the blob
 * @param contentType - MIME type of the file
 * @returns URL of the uploaded blob
 */
export const uploadBufferToBlobStorage = async (
    buffer: Buffer,
    blobName: string,
    contentType: string = 'application/pdf'
): Promise<string | null> => {
    try {
        if (!containerClient) {
            containerClient = await initializeBlobClient();
        }

        if (!containerClient) {
            console.log('[Blob Storage] Not available, skipping buffer upload');
            return null;
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.upload(buffer, buffer.length, {
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        });

        const blobUrl = `https://miscomprasstorage.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;
        console.log('[Blob Storage] Buffer uploaded successfully:', blobUrl);
        return blobUrl;
    } catch (error) {
        console.error('[Blob Storage] Buffer upload failed:', error);
        return null;
    }
};

/**
 * Delete a blob from storage
 * @param blobName - Name of the blob to delete
 */
export const deleteFromBlobStorage = async (blobName: string): Promise<boolean> => {
    try {
        if (!containerClient) {
            containerClient = await initializeBlobClient();
        }

        if (!containerClient) {
            return false;
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        console.log('[Blob Storage] Deleted blob:', blobName);
        return true;
    } catch (error) {
        console.error('[Blob Storage] Delete failed:', error);
        return false;
    }
};

/**
 * Process multiple files from Multer and upload them to Blob Storage
 * @param files - Array of Multer files
 * @param folder - Folder name in blob (e.g. 'requirements')
 * @returns Array of attachment objects for Prisma
 */
export const processFileUploads = async (files: Express.Multer.File[] | undefined, folder: string = 'requirements') => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];

    return await Promise.all(files.map(async (file) => {
        try {
            const blobName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const blobUrl = await uploadToBlobStorage(file.path, blobName);

            if (blobUrl) {
                return {
                    fileName: file.originalname,
                    fileUrl: blobUrl
                };
            } else {
                logger.warn(`Failed to upload ${file.originalname} to Blob Storage, using local path.`);
                // Normalize path for web: replace backslashes and ensure it starts correctly
                const normalizedPath = file.path.replace(/\\/g, '/');
                return {
                    fileName: file.originalname,
                    fileUrl: normalizedPath
                };
            }
        } catch (err) {
            logger.error(`Error processing file ${file.originalname}:`, err);
            const normalizedPath = file.path.replace(/\\/g, '/');
            return {
                fileName: file.originalname,
                fileUrl: normalizedPath
            };
        }
    }));
};

/**
 * Check if Blob Storage is configured and available
 */
export const isBlobStorageAvailable = (): boolean => {
    return !!AZURE_STORAGE_CONNECTION_STRING;
};
