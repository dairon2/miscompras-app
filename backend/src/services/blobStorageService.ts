import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import logger from './logger';

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'pdfs';

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

        // Read file and upload
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const fileBuffer = fs.readFileSync(filePath);

        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: 'application/pdf'
            }
        });

        const blobUrl = blockBlobClient.url;
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

        const blobUrl = blockBlobClient.url;
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
 * Check if Blob Storage is configured and available
 */
export const isBlobStorageAvailable = (): boolean => {
    return !!AZURE_STORAGE_CONNECTION_STRING;
};
