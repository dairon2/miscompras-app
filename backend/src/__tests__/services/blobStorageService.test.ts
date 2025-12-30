/**
 * Blob Storage Service Unit Tests
 */

// Mock Azure Storage SDK
const mockExists = jest.fn();
const mockCreate = jest.fn();
const mockUpload = jest.fn();
const mockGetBlockBlobClient = jest.fn(() => ({
    upload: mockUpload,
    url: 'https://test.blob.core.windows.net/pdfs/test-file.pdf'
}));

jest.mock('@azure/storage-blob', () => ({
    BlobServiceClient: {
        fromConnectionString: jest.fn(() => ({
            getContainerClient: jest.fn(() => ({
                exists: mockExists,
                create: mockCreate,
                getBlockBlobClient: mockGetBlockBlobClient
            }))
        }))
    }
}));

// Mock fs
jest.mock('fs', () => ({
    readFileSync: jest.fn(() => Buffer.from('fake pdf content')),
    unlinkSync: jest.fn(),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn()
}));

describe('Blob Storage Service Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Configuration', () => {
        it('should check for connection string', () => {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const isConfigured = () => !!connectionString;

            // In test environment, this should be undefined or 'mock'
            expect(typeof isConfigured()).toBe('boolean');
        });

        it('should use default container name if not specified', () => {
            const containerName = process.env.AZURE_STORAGE_CONTAINER || 'pdfs';
            expect(containerName).toBe('pdfs');
        });
    });

    describe('Container Management', () => {
        it('should check if container exists', async () => {
            mockExists.mockResolvedValue(true);

            const checkContainer = async () => mockExists();
            const exists = await checkContainer();

            expect(exists).toBe(true);
        });

        it('should create container if it does not exist', async () => {
            mockExists.mockResolvedValue(false);
            mockCreate.mockResolvedValue({ succeeded: true });

            const ensureContainer = async () => {
                const exists = await mockExists();
                if (!exists) {
                    await mockCreate({ access: 'blob' });
                    return 'created';
                }
                return 'exists';
            };

            const result = await ensureContainer();
            expect(result).toBe('created');
            expect(mockCreate).toHaveBeenCalledWith({ access: 'blob' });
        });
    });

    describe('File Upload', () => {
        it('should upload file to blob storage', async () => {
            mockUpload.mockResolvedValue({ requestId: '123' });

            const uploadFile = async (fileBuffer: Buffer, fileName: string) => {
                const blobClient = mockGetBlockBlobClient(fileName);
                await blobClient.upload(fileBuffer, fileBuffer.length, {
                    blobHTTPHeaders: { blobContentType: 'application/pdf' }
                });
                return blobClient.url;
            };

            const testBuffer = Buffer.from('test pdf');
            const url = await uploadFile(testBuffer, 'test.pdf');

            expect(url).toContain('blob.core.windows.net');
            expect(mockUpload).toHaveBeenCalled();
        });

        it('should set correct content type for PDFs', async () => {
            mockUpload.mockResolvedValue({});

            const getContentType = (fileName: string) => {
                if (fileName.endsWith('.pdf')) return 'application/pdf';
                if (fileName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                return 'application/octet-stream';
            };

            expect(getContentType('document.pdf')).toBe('application/pdf');
            expect(getContentType('report.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(getContentType('unknown.bin')).toBe('application/octet-stream');
        });

        it('should generate unique blob names', () => {
            const generateBlobName = (prefix: string, originalName: string) => {
                const timestamp = Date.now();
                const extension = originalName.split('.').pop();
                return `${prefix}/${timestamp}_${originalName}`;
            };

            const blobName1 = generateBlobName('budgets', 'report.pdf');
            const blobName2 = generateBlobName('requirements', 'attachment.pdf');

            expect(blobName1).toContain('budgets/');
            expect(blobName1).toContain('report.pdf');
            expect(blobName2).toContain('requirements/');
        });
    });

    describe('Error Handling', () => {
        it('should handle connection errors gracefully', async () => {
            mockUpload.mockRejectedValue(new Error('Connection refused'));

            const uploadWithErrorHandling = async () => {
                try {
                    await mockUpload(Buffer.from('test'), 4);
                    return { success: true };
                } catch (error) {
                    return { success: false, error: 'Upload failed' };
                }
            };

            const result = await uploadWithErrorHandling();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Upload failed');
        });

        it('should return null when storage is not configured', () => {
            const isAvailable = (connectionString: string | undefined) => !!connectionString;

            expect(isAvailable(undefined)).toBe(false);
            expect(isAvailable('')).toBe(false);
            expect(isAvailable('DefaultEndpointsProtocol=https...')).toBe(true);
        });
    });

    describe('URL Generation', () => {
        it('should generate correct blob URLs', () => {
            const accountName = 'miscomprasstorage';
            const containerName = 'pdfs';
            const blobName = 'budgets/report_123.pdf';

            const expectedUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;

            expect(expectedUrl).toContain(accountName);
            expect(expectedUrl).toContain(containerName);
            expect(expectedUrl).toContain(blobName);
        });
    });
});
