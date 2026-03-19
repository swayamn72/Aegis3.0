import LFTPost from '../models/lftPost.model.js';
import LFPPost from '../models/lfpPost.model.js';

/**
 * Deactivates any active LFT (Looking For Team) post for a specific player.
 * Useful when a player joins a team.
 * 
 * @param {string|mongoose.Types.ObjectId} playerId 
 */
export const deactivateLFTPost = async (playerId) => {
  try {
    const result = await LFTPost.updateMany(
      { player: playerId, status: 'active' },
      { $set: { status: 'inactive' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Deactivated ${result.modifiedCount} LFT posts for player ${playerId}`);
    }
  } catch (error) {
    console.error('Error deactivating LFT post:', error);
  }
};

/**
 * Deactivates any active LFP (Looking For Player) post for a specific team.
 * Useful when a team's roster is full or they want to stop recruiting.
 * 
 * @param {string|mongoose.Types.ObjectId} teamId 
 */
export const deactivateLFPPost = async (teamId) => {
  try {
    const result = await LFPPost.updateMany(
      { team: teamId, status: 'active' },
      { $set: { status: 'inactive' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Deactivated ${result.modifiedCount} LFP posts for team ${teamId}`);
    }
  } catch (error) {
    console.error('Error deactivating LFP post:', error);
  }
};
