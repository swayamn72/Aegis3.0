import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true,
  },
  type: {
    type: String,
    enum: ['contact', 'bug'],
    required: true,
  },
  subject: {
    type: String, // Title for bug
    required: true,
  },
  category: {
    type: String, // Used for contact category
  },
  message: {
    type: String, // Message or steps to reproduce
    required: true,
  },
  priority: {
    type: String, // Used for bug
    enum: ['low', 'medium', 'high', 'critical'],
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
  },
}, { timestamps: true });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
