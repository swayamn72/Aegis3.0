import express from 'express';
import auth from '../middleware/auth.js';
import SupportRequest from '../models/supportRequest.model.js';
import BugReport from '../models/bugReport.model.js';

const router = express.Router();

// ---- CONFIG ----
const MAX_SUBJECT_LEN = 120;
const MAX_CATEGORY_LEN = 60;
const MAX_MESSAGE_LEN = 2000;
const MAX_TITLE_LEN = 120;
const MAX_STEPS_LEN = 3000;

// UTILITY: sanitize + cap size
const clean = (str, max) => String(str || '').trim().slice(0, max);

// ---------------------------
// POST /api/support/contact  (Support Request)
// ---------------------------
router.post('/contact', auth, async (req, res) => {
  try {
    let { subject, category, message } = req.body;
    const userId = req.user.id;

    subject = clean(subject, MAX_SUBJECT_LEN);
    category = clean(category, MAX_CATEGORY_LEN);
    message = clean(message, MAX_MESSAGE_LEN);

    if (!subject || !category || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const supportRequest = new SupportRequest({
      userId,
      subject,
      category,
      message,
      status: 'pending'
    });

    await supportRequest.save();

    return res.status(201).json({
      message: 'Support request submitted successfully',
      requestId: supportRequest._id
    });

  } catch (err) {
    console.error('Error creating support request:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// ---------------------------
// POST /api/support/bug   (Bug Report)
// ---------------------------
router.post('/bug', auth, async (req, res) => {
  try {
    let { title, stepsToReproduce, priority } = req.body;
    const userId = req.user.id;

    title = clean(title, MAX_TITLE_LEN);
    stepsToReproduce = clean(stepsToReproduce, MAX_STEPS_LEN);
    priority = clean(priority || 'Low', 20);

    if (!title || !stepsToReproduce) {
      return res.status(400).json({ message: 'Title and steps to reproduce are required' });
    }

    const bugReport = new BugReport({
      userId,
      title,
      stepsToReproduce,
      priority,
      status: 'open'
    });

    await bugReport.save();

    return res.status(201).json({
      message: 'Bug report submitted successfully',
      reportId: bugReport._id
    });

  } catch (err) {
    console.error('Error creating bug report:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;