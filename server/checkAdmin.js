import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Admin from './models/admin.model.js';

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const admin = await Admin.findOne({ email: 'admin@aegis.com' });
    if (admin) {
      console.log('Admin user found:');
      console.log('Email:', admin.email);
      console.log('Username:', admin.username);
      console.log('Password hash exists:', !!admin.password);
    } else {
      console.log('Admin user not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkAdmin();
