import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Admin from './models/admin.model.js';

const resetAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin user
    await Admin.deleteMany({ email: 'admin@aegis.com' });
    console.log('Deleted existing admin user');

    // Create new admin user
    const admin = new Admin({
      email: 'admin@aegis.com',
      password: 'admin123',
      username: 'Admin',
      role: 'admin',
      permissions: [
        'canCreateTournament',
        'canEditTournament',
        'canDeleteTournament',
        'canCreateMatch',
        'canEditMatch',
        'canDeleteMatch'
      ],
      isActive: true
    });

    await admin.save();
    console.log('New admin user created successfully!');
    console.log('Email: admin@aegis.com');
    console.log('Password: admin123');

    process.exit(0);
  } catch (error) {
    console.error('Error resetting admin:', error);
    process.exit(1);
  }
};

resetAdmin();
