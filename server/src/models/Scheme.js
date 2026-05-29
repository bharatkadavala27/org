import mongoose from 'mongoose';

const schemeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['samuh_lagna', 'mameru', 'other'],
      default: 'other',
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Scheme', schemeSchema);
