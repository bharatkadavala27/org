import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    year: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 }, // 2-dp rupees
    vendor: { type: String, trim: true },
    receiptUrl: { type: String },
    gstNumber: { type: String, trim: true },
    taxAmount: { type: Number, min: 0 },
    status: { type: String, enum: ['submitted', 'approved', 'rejected'], default: 'submitted' },
    rejectReason: { type: String, trim: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ schemeId: 1, year: 1 });

export default mongoose.model('Expense', expenseSchema);
