import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import {
  processImage,
  processProfilePicture,
  processTeamLogo,
  processTournamentBanner,
  processPostMedia,
  getImageMetadata,
  validateImage,
  convertFormat,
  createThumbnail,
  resizeToFit,
  SUPPORTED_FORMATS,
  DEFAULT_CONFIG
} from '../config/imageProcessor.js';

// Create a test image buffer
const createTestImage = async (width = 800, height = 600) => {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  })
  .jpeg({ quality: 90 })
  .toBuffer();
};

console.log('🧪 Starting Image Processor Tests...\n');

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
};

// Test 1: processImage basic functionality
await test('processImage should resize image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await processImage(inputBuffer, { width: 300, height: 300 });
  
  if (!result || !(result instanceof Buffer)) {
    throw new Error('Expected Buffer result');
  }
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 300 || metadata.height !== 300) {
    throw new Error(`Expected 300x300, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 2: processProfilePicture
await test('processProfilePicture should create 300x300 image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await processProfilePicture(inputBuffer);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 300 || metadata.height !== 300) {
    throw new Error(`Expected 300x300, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 3: processTeamLogo
await test('processTeamLogo should create 500x500 image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await processTeamLogo(inputBuffer);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 500 || metadata.height !== 500) {
    throw new Error(`Expected 500x500, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 4: processTournamentBanner
await test('processTournamentBanner should create 1200x630 image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await processTournamentBanner(inputBuffer);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630) {
    throw new Error(`Expected 1200x630, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 5: processPostMedia
await test('processPostMedia should create 1080x1080 image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await processPostMedia(inputBuffer);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 1080 || metadata.height !== 1080) {
    throw new Error(`Expected 1080x1080, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 6: getImageMetadata
await test('getImageMetadata should return correct metadata', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const metadata = await getImageMetadata(inputBuffer);
  
  if (metadata.width !== 800 || metadata.height !== 600) {
    throw new Error(`Expected 800x600, got ${metadata.width}x${metadata.height}`);
  }
  
  if (!metadata.format || !metadata.size || metadata.sizeInMB === undefined) {
    throw new Error('Missing metadata fields');
  }
});

// Test 7: validateImage - valid image
await test('validateImage should pass for valid image', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await validateImage(inputBuffer, {
    minWidth: 100,
    minHeight: 100,
    maxWidth: 2000,
    maxHeight: 2000
  });
  
  if (!result.valid) {
    throw new Error(`Expected valid, got errors: ${result.errors.join(', ')}`);
  }
});

// Test 8: validateImage - invalid width
await test('validateImage should fail for image too small', async () => {
  const inputBuffer = await createTestImage(50, 50);
  const result = await validateImage(inputBuffer, {
    minWidth: 100,
    minHeight: 100
  });
  
  if (result.valid) {
    throw new Error('Expected invalid result');
  }
});

// Test 9: validateImage - invalid aspect ratio
await test('validateImage should fail for wrong aspect ratio', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await validateImage(inputBuffer, {
    aspectRatio: '1:1'
  });
  
  if (result.valid) {
    throw new Error('Expected invalid result for aspect ratio');
  }
});

// Test 10: validateImage - correct aspect ratio
await test('validateImage should pass for correct aspect ratio', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await validateImage(inputBuffer, {
    aspectRatio: '4:3'
  });
  
  if (!result.valid) {
    throw new Error(`Expected valid, got errors: ${result.errors.join(', ')}`);
  }
});

// Test 11: convertFormat to PNG
await test('convertFormat should convert to PNG', async () => {
  const inputBuffer = await createTestImage(200, 200);
  const result = await convertFormat(inputBuffer, 'png');
  
  const metadata = await sharp(result).metadata();
  if (metadata.format !== 'png') {
    throw new Error(`Expected png, got ${metadata.format}`);
  }
});

// Test 12: convertFormat to WebP
await test('convertFormat should convert to WebP', async () => {
  const inputBuffer = await createTestImage(200, 200);
  const result = await convertFormat(inputBuffer, 'webp');
  
  const metadata = await sharp(result).metadata();
  if (metadata.format !== 'webp') {
    throw new Error(`Expected webp, got ${metadata.format}`);
  }
});

// Test 13: createThumbnail
await test('createThumbnail should create square thumbnail', async () => {
  const inputBuffer = await createTestImage(800, 600);
  const result = await createThumbnail(inputBuffer, 150);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width !== 150 || metadata.height !== 150) {
    throw new Error(`Expected 150x150, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 14: resizeToFit
await test('resizeToFit should maintain aspect ratio', async () => {
  const inputBuffer = await createTestImage(2000, 1000);
  const result = await resizeToFit(inputBuffer, 500, 500);
  
  const metadata = await sharp(result).metadata();
  if (metadata.width > 500 || metadata.height > 500) {
    throw new Error(`Expected max 500x500, got ${metadata.width}x${metadata.height}`);
  }
});

// Test 15: SUPPORTED_FORMATS export
await test('SUPPORTED_FORMATS should contain expected formats', async () => {
  const expectedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif'];
  
  for (const format of expectedFormats) {
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Missing format: ${format}`);
    }
  }
});

// Test 16: DEFAULT_CONFIG export
await test('DEFAULT_CONFIG should have correct values', async () => {
  if (DEFAULT_CONFIG.width !== 300 || DEFAULT_CONFIG.height !== 300) {
    throw new Error('DEFAULT_CONFIG values are incorrect');
  }
});

// Test 17: processImage with PNG format
await test('processImage should handle PNG format', async () => {
  const inputBuffer = await createTestImage(200, 200);
  const result = await processImage(inputBuffer, { format: 'png' });
  
  const metadata = await sharp(result).metadata();
  if (metadata.format !== 'png') {
    throw new Error(`Expected png, got ${metadata.format}`);
  }
});

// Test 18: processImage with WebP format
await test('processImage should handle WebP format', async () => {
  const inputBuffer = await createTestImage(200, 200);
  const result = await processImage(inputBuffer, { format: 'webp' });
  
  const metadata = await sharp(result).metadata();
  if (metadata.format !== 'webp') {
    throw new Error(`Expected webp, got ${metadata.format}`);
  }
});

// Test 19: validateImage - file size check
await test('validateImage should check file size', async () => {
  // Create a large image (will be around 1MB+)
  const inputBuffer = await createTestImage(2000, 2000);
  const result = await validateImage(inputBuffer, {
    maxSizeInMB: 0.1 // Very small limit
  });
  
  if (result.valid) {
    throw new Error('Expected invalid due to file size');
  }
});

// Test 20: Image compression reduces size
await test('processImage should compress and reduce file size', async () => {
  const inputBuffer = await createTestImage(1000, 1000);
  const result = await processImage(inputBuffer, { quality: 50 });
  
  if (result.length >= inputBuffer.length) {
    throw new Error('Compressed image should be smaller');
  }
  
  console.log(`   Original: ${(inputBuffer.length / 1024).toFixed(2)}KB, Compressed: ${(result.length / 1024).toFixed(2)}KB`);
});

console.log('\n========================================');
console.log(`🧪 Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
