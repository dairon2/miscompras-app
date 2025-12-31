"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlobStorageAvailable = exports.deleteFromBlobStorage = exports.uploadBufferToBlobStorage = exports.uploadToBlobStorage = void 0;
const storage_blob_1 = require("@azure/storage-blob");
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("./logger"));
// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'pdfs';
let containerClient = null;
/**
 * Initialize Azure Blob Storage client
 */
const initializeBlobClient = async () => {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
        logger_1.default.blob('Connection string not configured, using local storage');
        return null;
    }
    try {
        const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const client = blobServiceClient.getContainerClient(CONTAINER_NAME);
        // Create container if it doesn't exist
        const exists = await client.exists();
        if (!exists) {
            await client.create({ access: 'blob' }); // Public read access for blobs
            logger_1.default.blob('Created container:', CONTAINER_NAME);
        }
        logger_1.default.blob('Initialized successfully');
        return client;
    }
    catch (error) {
        logger_1.default.error('Blob Storage failed to initialize:', error);
        return null;
    }
};
/**
 * Upload a file to Azure Blob Storage
 * @param filePath - Local path to the file
 * @param blobName - Name for the blob in storage
 * @returns URL of the uploaded blob, or null if upload failed
 */
const uploadToBlobStorage = async (filePath, blobName) => {
    try {
        // Initialize client if not already done
        if (!containerClient) {
            containerClient = await initializeBlobClient();
        }
        if (!containerClient) {
            logger_1.default.blob('Not available, skipping upload');
            return null;
        }
        // Read file and upload
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const fileBuffer = fs_1.default.readFileSync(filePath);
        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: 'application/pdf'
            }
        });
        const blobUrl = blockBlobClient.url;
        logger_1.default.blob('Uploaded successfully:', blobUrl);
        // Delete local file after successful upload
        try {
            fs_1.default.unlinkSync(filePath);
            logger_1.default.blob('Deleted local file:', filePath);
        }
        catch (deleteError) {
            logger_1.default.warn('Could not delete local file:', deleteError);
        }
        return blobUrl;
    }
    catch (error) {
        logger_1.default.error('Blob Storage upload failed:', error);
        return null;
    }
};
exports.uploadToBlobStorage = uploadToBlobStorage;
/**
 * Upload a buffer directly to Azure Blob Storage
 * @param buffer - File buffer
 * @param blobName - Name for the blob
 * @param contentType - MIME type of the file
 * @returns URL of the uploaded blob
 */
const uploadBufferToBlobStorage = async (buffer, blobName, contentType = 'application/pdf') => {
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
    }
    catch (error) {
        console.error('[Blob Storage] Buffer upload failed:', error);
        return null;
    }
};
exports.uploadBufferToBlobStorage = uploadBufferToBlobStorage;
/**
 * Delete a blob from storage
 * @param blobName - Name of the blob to delete
 */
const deleteFromBlobStorage = async (blobName) => {
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
    }
    catch (error) {
        console.error('[Blob Storage] Delete failed:', error);
        return false;
    }
};
exports.deleteFromBlobStorage = deleteFromBlobStorage;
/**
 * Check if Blob Storage is configured and available
 */
const isBlobStorageAvailable = () => {
    return !!AZURE_STORAGE_CONNECTION_STRING;
};
exports.isBlobStorageAvailable = isBlobStorageAvailable;
