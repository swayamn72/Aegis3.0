import sharp from 'sharp';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

export const validateUploadedImage = async (
    file,
    { maxBytes = 5 * 1024 * 1024 } = {},
) => {
    if (!file || !file.buffer) {
        throw new Error('No file uploaded');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        throw new Error('Unsupported image type. Use JPEG, PNG, or WEBP.');
    }

    if (file.size > maxBytes) {
        throw new Error('Image exceeds maximum allowed size');
    }

    // Decode to verify this is a valid image payload and not a spoofed MIME type.
    const metadata = await sharp(file.buffer, { failOnError: true }).metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
    }

    return metadata;
};

export { ALLOWED_IMAGE_MIME_TYPES };