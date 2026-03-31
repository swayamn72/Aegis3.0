import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const badgesDir = path.resolve(__dirname, '../../client/public/badges');

const badges = [
  'iron_badge.png',
  'bronze_badge.png',
  'silver_badge.png',
  'gold_badge.png',
  'platinum_badge.png',
  'diamond_badge.png',
  'master_badge.png',
  'aegis_badge.png',
];

async function uploadBadges() {
  const results = {};
  for (const badge of badges) {
    const filePath = path.join(badgesDir, badge);
    if (fs.existsSync(filePath)) {
      console.log(`Uploading ${badge}...`);
      try {
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'aegis/badges',
          public_id: badge.split('.')[0],
          overwrite: true,
          resource_type: 'image',
        });
        results[badge] = result.secure_url;
        console.log(`Success: ${result.secure_url}`);
      } catch (error) {
        console.error(`Error uploading ${badge}:`, error);
      }
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  }
  console.log('\n--- Final Cloudinary URLs ---\n');
  console.log(JSON.stringify(results, null, 2));
}

uploadBadges();
