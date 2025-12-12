import mongoose from "mongoose";
import bcrypt from "bcrypt";

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'admin'
  },
  permissions: [{
    type: String,
    enum: ['canCreateTournament', 'canEditTournament', 'canDeleteTournament', 'canCreateMatch', 'canEditMatch', 'canDeleteMatch']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  lastLogin: Date
}, { timestamps: true });

// Hash password before saving
adminSchema.pre('save', function(next) {
  // Only hash the password if it's being modified (new or changed)
  if (!this.isModified('password')) return next();

  // Skip hashing if password is already hashed (starts with $2b$ or $2a$)
  if (this.password && (this.password.startsWith('$2b$') || this.password.startsWith('$2a$'))) {
    return next();
  }

  const user = this;
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Login attempts methods
adminSchema.methods.incLoginAttempts = function() {
  const newAttempts = this.loginAttempts + 1;
  const updateData = { loginAttempts: newAttempts };

  if (newAttempts >= 5) {
    updateData.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  }

  return Admin.findByIdAndUpdate(this._id, updateData, { new: true });
};

adminSchema.methods.resetLoginAttempts = function() {
  return Admin.findByIdAndUpdate(this._id, {
    loginAttempts: 0,
    lockUntil: undefined,
    lastLogin: new Date()
  });
};

adminSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
