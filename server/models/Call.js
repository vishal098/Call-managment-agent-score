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
  issueDecisions: [
    {
      issueId: { type: mongoose.Schema.Types.ObjectId, required: true },
      status: { type: String, enum: ['valid', 'invalid'], required: true },
    },
  ],
});

const recordingSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    provider: { type: String, default: '' },
    transcriptionModel: { type: String, default: '' },
    scoringModel: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const callSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, index: true },
    agentName: { type: String, required: true },
    customer: { type: String, required: true },
    durationSeconds: { type: Number, required: true },
    callAt: { type: Date, required: true, index: true },
    aiScore: { type: Number, default: null, min: 0, max: 100 },
    flaggedIssues: [issueSchema],
    reviews: [reviewSchema],
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'completed', 'failed'],
      default: 'completed',
    },
    recording: { type: recordingSchema, default: null },
    transcript: { type: String, default: '' },
    analysis: { type: analysisSchema, default: null },
    processingError: { type: String, default: '' },
    seeded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

callSchema.index({ agentId: 1, callAt: -1 });

export default mongoose.model('Call', callSchema);
