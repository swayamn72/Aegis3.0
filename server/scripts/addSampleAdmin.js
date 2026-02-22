
import mongoose from 'mongoose';
import Admin from '../models/admin.model.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || typeof MONGO_URI !== 'string' || MONGO_URI.trim() === '') {
    console.error('Error: MONGO_URI is not set. Please set the environment variable in your .env file.');
    process.exit(1);
}

async function main() {
    await mongoose.connect(MONGO_URI);

    const sampleAdmin = {
        email: 'admin@aegis.com',
        password: 'admin123',
        username: 'admin',
        role: 'admin',
        permissions: ['canCreateTournament', 'canEditTournament', 'canDeleteTournament', 'canCreateMatch', 'canEditMatch', 'canDeleteMatch'],
        isActive: true
    };

    try {
        // Check if admin already exists
        const existing = await Admin.findOne({ email: sampleAdmin.email });
        if (existing) {
            console.log('Admin already exists:', existing.email);
            process.exit(0);
        }
        const admin = new Admin(sampleAdmin);
        await admin.save();
        console.log('Sample admin created:', admin.email);
    } catch (err) {
        console.error('Error creating admin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
