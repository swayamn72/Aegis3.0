import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImages() {
  try {
    const valoResult = await cloudinary.uploader.upload(join(__dirname, '../../client/src/assets/gameLogos/valorant2.png'), {
      folder: 'gameLogos',
      public_id: 'valorant2',
      overwrite: true,
    });
    console.log('Valorant2 Logo uploaded:', valoResult.secure_url);
  } catch (err) {
    console.error('Error uploading:', err);
  }
}

uploadImages();
