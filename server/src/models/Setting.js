import mongoose from 'mongoose';

// Single source for admin-configurable values (UPI config, theme/homepage).
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
