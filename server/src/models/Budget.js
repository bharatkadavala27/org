import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    year: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    plannedAmount: { type: Number, required: true, min: 0 }, // 2-dp rupees
  },
  { timestamps: true }
);

budgetSchema.index({ schemeId: 1, year: 1, category: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);
