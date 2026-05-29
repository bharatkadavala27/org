import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    year: { type: Number, required: true },
    side: { type: String, enum: ['groom', 'bride', 'na'], default: 'na' },
    formTemplateVersion: { type: Number, required: true },
    values: { type: Object, default: {} },
    coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', default: null },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'verified', 'rejected'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

registrationSchema.index({ schemeId: 1, year: 1 });

export default mongoose.model('Registration', registrationSchema);
