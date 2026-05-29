import mongoose from 'mongoose';

const slipSchema = new mongoose.Schema(
  {
    slipId: { type: String, required: true, unique: true },
    bookNumber: { type: String, trim: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', default: null },
    isAnonymous: { type: Boolean, default: false },
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    year: { type: Number, required: true },
    // Money: 2-dp rupees (see lib/money.js).
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'cheque'], required: true },
    paymentRef: { type: String, trim: true },
    paymentConfirmed: { type: Boolean, default: false },
    receiptUrl: { type: String }, // donor-uploaded payment screenshot (Cloudinary)
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    // True once this slip is part of a CONFIRMED handover (locked).
    inConfirmedHandover: { type: Boolean, default: false },
    issuedAt: { type: Date, default: Date.now },
    importHash: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

slipSchema.index({ schemeId: 1, year: 1 });
slipSchema.index({ donorId: 1 });
slipSchema.index({ collectedBy: 1 });

export default mongoose.model('Slip', slipSchema);
