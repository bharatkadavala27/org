import mongoose from 'mongoose';

const coupleSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    groomRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    brideRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    village: { type: String, trim: true },
    registrationNo: { type: String, trim: true }, // patrika no
    status: { type: String, default: 'draft' },
  },
  { timestamps: true }
);

export default mongoose.model('Couple', coupleSchema);
