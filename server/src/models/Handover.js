import mongoose from 'mongoose';

const handoverSchema = new mongoose.Schema(
  {
    subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slip' }],
    expectedTotal: { type: Number, required: true, min: 0 },
    receivedTotal: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true }, // receivedTotal - expectedTotal
    status: {
      type: String,
      enum: ['submitted', 'confirmed', 'disputed', 'resolved'],
      default: 'submitted',
    },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Handover', handoverSchema);
