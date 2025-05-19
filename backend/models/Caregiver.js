// Caregiver.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const caregiverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`,
    },
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // New field to hold the connected patient's email
  patientEmail: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
  },
  fcmToken: {
    type: String,
    default: null
  },
  // Add a new patientData field to store data for multiple patients
  patientData: {
    type: Map,
    of: {
      reminders: {
        type: Array,
        default: []
      },
      memories: {
        type: Array,
        default: []
      },
      emergencyContacts: {
        type: Array,
        default: []
      },
      homeLocation: {
        type: Object,
        default: null
      },
      lastSync: {
        type: Date,
        default: Date.now
      }
    },
    default: {}
  },
  // Keep track of all connected patients (for future multi-patient support)
  connectedPatients: {
    type: [String],
    default: []
  }
});

caregiverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

caregiverSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Caregiver', caregiverSchema);
