import mongoose from 'mongoose';

const villageAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    village: { type: String, required: true, trim: true },
    taluka: { type: String, trim: true },
    jilla: { type: String, trim: true },
  },
  { timestamps: true }
);

villageAssignmentSchema.index({ userId: 1, village: 1 }, { unique: true });

export default mongoose.model('VillageAssignment', villageAssignmentSchema);
