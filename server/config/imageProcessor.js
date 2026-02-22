import sharp from 'sharp';
import cloudinary from './cloudinary.js';

/**
 * Image Processing Module for Profile Pictures
 * Compresses and resizes images before uploading to Cloudinary
 */

// Default configuration for profile pictures
const DEFAULT_CONFIG = {
  width: 300,
  height: 300,
  quality: 80,
  format: 'jpeg',
  fit: 'cover',
  position: 'center'
};

// Supported formats
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif'];

// Format conversion mapping
const FORMAT_CONVERSION = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif'
};

/**
 * Process (compress and resize) an image buffer
 * @param {Buffer} inputBuffer - The original image buffer
 * @param {Object} config - Optional configuration overrides
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const processImage = async (inputBuffer, config = {}) => {
  const options = { ...DEFAULT_CONFIG, ...config };

  try {
    let processor = sharp(inputBuffer)
      .resize(options.width, options.height, {
        fit: options.fit,
        position: options.position
      });

    // Apply format-specific processing
    const format = options.format?.toLowerCase() || 'jpeg';
    
    switch (format) {
      case 'jpeg':
      case 'jpg':
        processor = processor.jpeg({ quality: options.quality });
        break;
      case 'png':
        processor = processor.png({ quality: options.quality, compressionLevel: 9 });
        break;
      case 'webp':
        processor = processor.webp({ quality: options.quality });
        break;
      case 'gif':
        processor = processor.gif();
        break;
      case 'avif':
        processor = processor.avif({ quality: options.quality });
        break;
      default:
        processor = processor.jpeg({ quality: options.quality });
    }

    const processedBuffer = await processor.toBuffer();
    return processedBuffer;
  } catch (error) {
    console.error('❌ Image processing error:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Process image with format conversion
 * @param {Buffer} inputBuffer - The original image buffer
 * @param {string} outputFormat - Target format (jpeg, png, webp, avif)
 * @param {Object} config - Optional configuration overrides
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const convertFormat = async (inputBuffer, outputFormat, config = {}) => {
  const format = outputFormat.toLowerCase();
  
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`Unsupported format: ${format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  return processImage(inputBuffer, { ...config, format });
};

/**
 * Process profile picture with default settings optimized for profile pictures
 * @param {Buffer} inputBuffer - The original image buffer
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const processProfilePicture = async (inputBuffer) => {
  return processImage(inputBuffer, {
    width: 300,
    height: 300,
    quality: 80
  });
};

/**
 * Process team logo with settings optimized for team logos
 * @param {Buffer} inputBuffer - The original image buffer
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const processTeamLogo = async (inputBuffer) => {
  return processImage(inputBuffer, {
    width: 500,
    height: 500,
    quality: 85
  });
};

/**
 * Process tournament banner with settings optimized for banners
 * @param {Buffer} inputBuffer - The original image buffer
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const processTournamentBanner = async (inputBuffer) => {
  return processImage(inputBuffer, {
    width: 1200,
    height: 630,
    quality: 85
  });
};

/**
 * Process post media with settings optimized for social media posts
 * @param {Buffer} inputBuffer - The original image buffer
 * @returns {Promise<Buffer>} - The processed image buffer
 */
export const processPostMedia = async (inputBuffer) => {
  return processImage(inputBuffer, {
    width: 1080,
    height: 1080,
    quality: 85
  });
};

/**
 * Validate image dimensions and aspect ratio
 * @param {Buffer} inputBuffer - The image buffer
 * @param {Object} validationRules - Validation rules
 * @returns {Promise<Object>} - Validation result with metadata
 */
export const validateImage = async (inputBuffer, validationRules = {}) => {
  const {
    minWidth = 0,
    minHeight = 0,
    maxWidth = Infinity,
    maxHeight = Infinity,
    allowedFormats = SUPPORTED_FORMATS,
    aspectRatio = null, // e.g., '16:9', '1:1', '4:3'
    maxSizeInMB = 10
  } = validationRules;

  try {
    const metadata = await sharp(inputBuffer).metadata();
    const errors = [];
    const warnings = [];

    // Check format
    if (!allowedFormats.includes(metadata.format)) {
      errors.push(`Invalid format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`);
    }

    // Check dimensions
    if (metadata.width < minWidth) {
      errors.push(`Width too small: ${metadata.width}px. Minimum: ${minWidth}px`);
    }
    if (metadata.height < minHeight) {
      errors.push(`Height too small: ${metadata.height}px. Minimum: ${minHeight}px`);
    }
    if (metadata.width > maxWidth) {
      errors.push(`Width too large: ${metadata.width}px. Maximum: ${maxWidth}px`);
    }
    if (metadata.height > maxHeight) {
      errors.push(`Height too large: ${metadata.height}px. Maximum: ${maxHeight}px`);
    }

    // Check file size
    const sizeInMB = inputBuffer.length / (1024 * 1024);
    if (sizeInMB > maxSizeInMB) {
      errors.push(`File too large: ${sizeInMB.toFixed(2)}MB. Maximum: ${maxSizeInMB}MB`);
    }

    // Check aspect ratio
    if (aspectRatio) {
      const [targetWidth, targetHeight] = aspectRatio.split(':').map(Number);
      const currentRatio = metadata.width / metadata.height;
      const targetRatio = targetWidth / targetHeight;
      const tolerance = 0.05; // 5% tolerance

      if (Math.abs(currentRatio - targetRatio) > tolerance) {
        errors.push(`Invalid aspect ratio: ${currentRatio.toFixed(2)}. Expected: ${aspectRatio}`);
      }
    }

    // Warnings for non-optimized images
    if (metadata.width > 2000 || metadata.height > 2000) {
      warnings.push('Image is very large. Consider resizing for better performance.');
    }
    if (sizeInMB > 5) {
      warnings.push('Image is large. Consider compressing for faster uploads.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: inputBuffer.length,
        sizeInMB: sizeInMB.toFixed(2),
        hasAlpha: metadata.hasAlpha,
        aspectRatio: `${metadata.width}:${metadata.height}`
      }
    };
  } catch (error) {
    console.error('❌ Image validation error:', error);
    throw new Error('Failed to validate image');
  }
};

/**
 * Process and upload image to Cloudinary
 * @param {Buffer} inputBuffer - The original image buffer
 * @param {Object} options - Processing and upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const processAndUpload = async (inputBuffer, options = {}) => {
  const {
    folder = 'aegis-uploads',
    publicId = null,
    processConfig = {},
    transformation = [],
    ...uploadOptions
  } = options;

  try {
    // Process the image
    const processedBuffer = await processImage(inputBuffer, processConfig);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'image',
          transformation: transformation.length > 0 ? transformation : undefined,
          ...uploadOptions
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(processedBuffer);
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      createdAt: result.created_at
    };
  } catch (error) {
    console.error('❌ Process and upload error:', error);
    throw new Error('Failed to process and upload image');
  }
};

/**
 * Batch process multiple images
 * @param {Array<{buffer: Buffer, config?: Object}>} images - Array of image buffers with optional config
 * @param {Object} globalConfig - Global configuration applied to all images
 * @returns {Promise<Array<{index: number, success: boolean, buffer?: Buffer, error?: string}>>}
 */
export const batchProcess = async (images, globalConfig = {}) => {
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const { buffer, config = {} } = images[i];
    try {
      const processedBuffer = await processImage(buffer, { ...globalConfig, ...config });
      results.push({
        index: i,
        success: true,
        buffer: processedBuffer,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        reduction: ((1 - processedBuffer.length / buffer.length) * 100).toFixed(2)
      });
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Batch upload multiple images to Cloudinary
 * @param {Array<{buffer: Buffer, folder: string, publicId?: string, config?: Object}>} images - Array of image data
 * @param {Object} globalOptions - Global options applied to all uploads
 * @returns {Promise<Array<{index: number, success: boolean, result?: Object, error?: string}>>}
 */
export const batchUpload = async (images, globalOptions = {}) => {
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const { buffer, folder, publicId, config = {} } = images[i];
    try {
      const result = await processAndUpload(buffer, {
        ...globalOptions,
        folder: folder || globalOptions.folder,
        publicId,
        processConfig: config
      });
      results.push({
        index: i,
        success: true,
        ...result
      });
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Get image metadata
 * @param {Buffer} inputBuffer - The image buffer
 * @returns {Promise<Object>} - Image metadata
 */
export const getImageMetadata = async (inputBuffer) => {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: inputBuffer.length,
      sizeInMB: (inputBuffer.length / (1024 * 1024)).toFixed(2),
      hasAlpha: metadata.hasAlpha,
      space: metadata.space,
      density: metadata.density,
      chromaSubsampling: metadata.chromaSubsampling,
      isProgressive: metadata.isProgressive,
      orientation: metadata.orientation
    };
  } catch (error) {
    console.error('❌ Error getting image metadata:', error);
    throw new Error('Failed to get image metadata');
  }
};

/**
 * Create thumbnail from image
 * @param {Buffer} inputBuffer - The original image buffer
 * @param {number} size - Thumbnail size (square)
 * @returns {Promise<Buffer>} - The thumbnail buffer
 */
export const createThumbnail = async (inputBuffer, size = 150) => {
  return processImage(inputBuffer, {
    width: size,
    height: size,
    quality: 70,
    fit: 'cover',
    position: 'center'
  });
};

/**
 * Resize image to fit within dimensions while maintaining aspect ratio
 * @param {Buffer} inputBuffer - The original image buffer
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality
 * @returns {Promise<Buffer>} - The resized buffer
 */
export const resizeToFit = async (inputBuffer, maxWidth = 1920, maxHeight = 1080, quality = 85) => {
  return processImage(inputBuffer, {
    width: maxWidth,
    height: maxHeight,
    fit: 'inside',
    quality
  });
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - The Cloudinary public ID
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      publicId,
      result: result.result
    };
  } catch (error) {
    console.error('❌ Error deleting from Cloudinary:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
};

export default {
  processImage,
  processProfilePicture,
  processTeamLogo,
  processTournamentBanner,
  processPostMedia,
  getImageMetadata,
  validateImage,
  processAndUpload,
  convertFormat,
  batchProcess,
  batchUpload,
  createThumbnail,
  resizeToFit,
  deleteFromCloudinary,
  DEFAULT_CONFIG,
  SUPPORTED_FORMATS
};
