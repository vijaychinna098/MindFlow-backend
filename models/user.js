const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(v);
      },
      message: props => `${props.value} is not a valid Gmail address!`
    }
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false
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
  address: {
    type: String,
    default: ''
  },
  age: {
    type: String,
    default: ''
  },
  medicalInfo: {
    conditions: { type: String, default: '' },
    medications: { type: String, default: '' },
    allergies: { type: String, default: '' },
    bloodType: { type: String, default: '' }
  },
  homeLocation: {
    type: Object,
    default: null
  },
  passwordChangedAt: Date,
  fcmToken: {
    type: String,
    default: null
  },
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
  lastSyncTime: {
    type: Date,
    default: Date.now
  },
  caregiverEmail: {
    type: String,
    default: null
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordChangedAt = Date.now() - 1000;
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.post("save", function(error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    next(new Error("Email already exists"));
  } else {
    next(error);
  }
});

module.exports = mongoose.model("User", userSchema);
