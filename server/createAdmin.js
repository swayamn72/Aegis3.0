import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Admin from './models/admin.model.js';

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin user
    await Admin.deleteMany({ email: 'admin@aegis.com' });
    console.log('Deleted existing admin user');

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create new admin user with pre-hashed password
    const admin = new Admin({
      email: 'admin@aegis.com',
      password: hashedPassword,
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
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
