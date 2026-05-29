import mongoose from 'mongoose';

const donorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherOrHusbandName: { type: String, trim: true, default: '' },
    village: { type: String, trim: true, default: '' },
    taluka: { type: String, trim: true, default: '' },
    jilla: { type: String, trim: true, default: '' },
    mobile: { type: String, trim: true },
    mergedIntoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', default: null },
    archived: { type: Boolean, default: false },
    // For idempotent Excel import.
    importHash: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

donorSchema.index({ name: 'text', fatherOrHusbandName: 'text' });
donorSchema.index({ village: 1 });

export default mongoose.model('Donor', donorSchema);
