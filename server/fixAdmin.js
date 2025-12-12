import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Admin from './models/admin.model.js';

const fixAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find and update the admin user
    const admin = await Admin.findOne({ email: 'admin@aegis.com' });

    if (!admin) {
      console.log('Admin user not found');
      process.exit(1);
    }

    // Update permissions to be an array of strings
    admin.permissions = [
      'canCreateTournament',
      'canEditTournament',
      'canDeleteTournament',
      'canCreateMatch',
      'canEditMatch',
      'canDeleteMatch'
    ];

    await admin.save();
    console.log('Admin user fixed successfully!');
    console.log('Email: admin@aegis.com');
    console.log('Password: admin123');
    console.log('Permissions:', admin.permissions);

    process.exit(0);
  } catch (error) {
    console.error('Error fixing admin:', error);
    process.exit(1);
  }
};

fixAdmin();
