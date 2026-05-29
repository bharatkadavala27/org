import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'file', 'checkbox'],
      required: true,
    },
    required: { type: Boolean, default: false },
    validation: { type: mongoose.Schema.Types.Mixed }, // e.g. { min, max, pattern, options }
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const formTemplateSchema = new mongoose.Schema(
  {
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
    version: { type: Number, required: true },
    fields: [fieldSchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

formTemplateSchema.index({ schemeId: 1, version: 1 }, { unique: true });

export default mongoose.model('FormTemplate', formTemplateSchema);
