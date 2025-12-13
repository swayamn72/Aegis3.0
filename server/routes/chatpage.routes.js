// // GET /api/tryout-chats/:chatId - Get specific tryout chat
// router.get('/:chatId', auth, async (req, res) => {
//   try {
//     const { chatId } = req.params;

//     const chat = await TryoutChat.findById(chatId)
//       .populate('team', 'teamName teamTag logo captain')
//       .populate('applicant', 'username inGameName profilePicture')
//       .populate('participants', 'username profilePicture inGameName')
//       .populate({
//         path: 'messages.sender',
//         select: 'username profilePicture',
//       });

//     if (!chat) {
//       return res.status(404).json({ error: 'Chat not found' });
//     }

//     // Verify user is a participant
//     const isParticipant = chat.participants.some(
//       (p) => p._id.toString() === req.user.id.toString()
//     );

//     if (!isParticipant) {
//       return res.status(403).json({ error: 'You are not part of this chat' });
//     }

//     res.json({ chat });
//   } catch (error) {
//     console.error('Error fetching tryout chat:', error);
//     res.status(500).json({ error: 'Failed to fetch chat' });
//   }
// });