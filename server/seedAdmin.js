import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Admin from './models/admin.model.js';

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@aegis.com' });

    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email: admin@aegis.com');
      console.log('Password: admin123');
    } else {
      // Create admin user
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
      console.log('Admin user created successfully!');
      console.log('Email: admin@aegis.com');
      console.log('Password: admin123');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
