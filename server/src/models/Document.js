import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    type: { type: String, required: true },
    fileUrl: { type: String, required: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'verified', 'resubmit'], default: 'pending' },
    rejectReason: { type: String, trim: true },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
