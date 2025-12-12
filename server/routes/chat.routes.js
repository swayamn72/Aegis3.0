router.get('/users/with-chats', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ Use aggregation to exclude system messages properly
        const messages = await ChatMessage.aggregate([
            {
                $match: {
                    $and: [
                        { senderId: { $ne: 'system' } },  // ✅ Exclude system messages
                        {
                            $or: [
                                { senderId: userId },
                                { receiverId: userId }
                            ]
                        }
                    ]
                }
            },
            {
                $project: {
                    otherUserId: {
                        $cond: {
                            if: { $eq: ['$senderId', userId] },
                            then: '$receiverId',
                            else: '$senderId'
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$otherUserId'
                }
            }
        ]);

        // ✅ Filter out 'system' and null values
        const userIds = messages
            .map(m => m._id)
            .filter(id => id && id !== 'system' && id !== userId.toString());

        // ✅ Now query Player model with valid ObjectIds only
        const users = await Player.find({
            _id: { $in: userIds }
        })
            .select('username inGameName profilePicture aegisRating')
            .lean();

        res.json({ users });
    } catch (error) {
        console.error('Error in users/with-chats:', error);
        res.status(500).json({ error: 'Failed to fetch users with chats' });
    }
});
