import cron from 'node-cron';
import { applyDecay } from '../services/aegisRating.js';

// Every Monday at 03:00 UTC
export const startDecayCron = () => {
  cron.schedule('0 3 * * 1', async () => {
    console.log('⏰ Running weekly Aegis Rating decay...');
    try {
      const result = await applyDecay();
      console.log(`✅ Decay complete. ${result.modifiedCount} players affected.`);
    } catch (err) {
      console.error('❌ Aegis decay cron failed:', err);
    }
  });
  console.log('📅 Aegis Rating decay cron scheduled (Mon 03:00 UTC)');
};
