import express from 'express';
import auth from '../middleware/auth.js';
import SupportTicket from '../models/supportTicket.model.js';

const router = express.Router();

// POST /api/support/contact
router.post('/contact', auth, async (req, res) => {
  try {
    const { subject, category, message } = req.body;
    
    if (!subject || !message) {
      return res.fail(400, 'Subject and message are required');
    }

    const ticket = new SupportTicket({
      user: req.user.id,
      type: 'contact',
      subject,
      category,
      message,
    });

    await ticket.save();

    res.success({ message: 'Contact request submitted successfully' }, 200);
  } catch (error) {
    console.error('Submit contact error:', error);
    res.fail(500, 'Server error while submitting contact request');
  }
});

// POST /api/support/bug
router.post('/bug', auth, async (req, res) => {
  try {
    const { title, stepsToReproduce, priority } = req.body;
    
    if (!title || !stepsToReproduce) {
      return res.fail(400, 'Title and steps to reproduce are required');
    }

    const ticket = new SupportTicket({
      user: req.user.id,
      type: 'bug',
      subject: title,
      message: stepsToReproduce,
      priority: priority ? priority.toLowerCase() : 'medium',
    });

    await ticket.save();

    res.success({ message: 'Bug report submitted successfully' }, 200);
  } catch (error) {
    console.error('Submit bug report error:', error);
    res.fail(500, 'Server error while submitting bug report');
  }
});

export default router;
