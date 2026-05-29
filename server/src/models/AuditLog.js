import mongoose from 'mongoose';

// Append-only. No update/delete routes anywhere.
const auditLogSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String },
    entityId: { type: String },
    before: { type: Object },
    after: { type: Object },
  },
  { timestamps: false }
);

export default mongoose.model('AuditLog', auditLogSchema);
