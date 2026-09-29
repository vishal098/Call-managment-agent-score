import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  type: { type: String, required: true },
  timestampSeconds: { type: Number, required: true, min: 0 },
  note: { type: String, required: true },
});

const reviewSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  note: { type: String, default: '' },
  reviewedAt: { type: Date, default: Date.now },
  reviewer: { type: String, default: 'QA Manager' },
  issueDecisions: [{
    issueId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['valid', 'invalid'], required: true },
  }],
});

const callSchema = new mongoose.Schema({
  agentId: { type: String, required: true, index: true },
  agentName: { type: String, required: true },
  customer: { type: String, required: true },
  durationSeconds: { type: Number, required: true },
  callAt: { type: Date, required: true, index: true },
  aiScore: { type: Number, required: true, min: 0, max: 100 },
  flaggedIssues: [issueSchema],
  reviews: [reviewSchema],
  seeded: { type: Boolean, default: false },
}, { timestamps: true });

callSchema.index({ agentId: 1, callAt: -1 });

export default mongoose.model('Call', callSchema);