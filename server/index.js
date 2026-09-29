import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync, unlinkSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import OpenAI from 'openai';
import Call from './models/Call.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const uploadDirectory = resolve('uploads/recordings');
const allowedAudioExtensions = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm']);
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(uploadDirectory, { recursive: true });
      callback(null, uploadDirectory);
    },
    filename: (_req, file, callback) =>
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const supportedMimeType =
      file.mimetype.startsWith('audio/') ||
      ['application/octet-stream', 'video/mp4'].includes(file.mimetype);
    if (!allowedAudioExtensions.has(extension) || !supportedMimeType) {
      return callback(
        new Error('Upload an MP3, WAV, M4A, AAC, FLAC, OGG, or WEBM audio recording.'),
      );
    }
    callback(null, true);
  },
});
const transcriptionModel = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
const scoringModel = process.env.OPENAI_SCORING_MODEL || 'gpt-4o-mini';
const issueTypes = ['Compliance', 'Tone', 'Script adherence', 'Resolution', 'Empathy', 'Other'];

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use('/uploads', express.static(resolve('uploads')));

const latestReview = (call) => call.reviews.at(-1) ?? null;

function serializeCall(call, { includeTranscript = false } = {}) {
  const review = latestReview(call);
  const decisions = new Map(
    (review?.issueDecisions ?? []).map((item) => [String(item.issueId), item.status]),
  );
  return {
    id: String(call._id),
    agentId: call.agentId,
    agentName: call.agentName,
    customer: call.customer,
    durationSeconds: call.durationSeconds,
    callAt: call.callAt,
    aiScore: call.aiScore,
    managerScore: review?.score ?? null,
    reviewCount: call.reviews.length,
    status: call.status ?? (call.aiScore === null ? 'uploaded' : 'completed'),
    recording: call.recording
      ? {
          originalName: call.recording.originalName,
          mimeType: call.recording.mimeType,
          size: call.recording.size,
          url: `/uploads/recordings/${call.recording.filename}`,
        }
      : null,
    processingError: call.processingError ?? '',
    ...(includeTranscript ? { transcript: call.transcript ?? '' } : {}),
    analysis: call.analysis ?? null,
    issues: call.flaggedIssues.map((issue) => ({
      id: String(issue._id),
      type: issue.type,
      timestampSeconds: issue.timestampSeconds,
      note: issue.note,
      status: decisions.get(String(issue._id)) ?? 'pending',
    })),
  };
}

async function analyzeCall(callId) {
  try {
    const call = await Call.findById(callId);
    if (!call || !call.recording) throw new Error('The call recording could not be found.');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(resolve(uploadDirectory, call.recording.filename)),
      model: transcriptionModel,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    const segments = Array.isArray(transcription.segments)
      ? transcription.segments
          .map((segment) => ({ start: segment.start, text: segment.text.trim() }))
          .filter((segment) => segment.text)
      : [];
    if (!segments.length) throw new Error('Transcription did not return timestamped segments.');

    const completion = await client.chat.completions.create({
      model: scoringModel,
      messages: [
        {
          role: 'system',
          content: `You are a call-center quality reviewer. Score the call from 0 to 100 for compliance, verification and script adherence, empathy and tone, clarity, and resolution. Identify only issues supported by the transcript. For each issue, return the index of the transcript segment that contains evidence; never invent timestamps. Use one of these issue types: ${issueTypes.join(', ')}. Keep each note short and factual.`,
        },
        {
          role: 'user',
          content: JSON.stringify({ agent: call.agentName, customer: call.customer, segments }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'call_quality_review',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    type: { type: 'string', enum: issueTypes },
                    segmentIndex: { type: 'integer', minimum: 0 },
                    note: { type: 'string' },
                  },
                  required: ['type', 'segmentIndex', 'note'],
                },
              },
            },
            required: ['score', 'issues'],
          },
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Scoring returned an empty result.');
    const result = JSON.parse(content);
    if (
      !Number.isInteger(result.score) ||
      result.score < 0 ||
      result.score > 100 ||
      !Array.isArray(result.issues)
    ) {
      throw new Error('Scoring returned an invalid result.');
    }
    const flaggedIssues = result.issues.map((issue) => {
      const segment = segments[issue.segmentIndex];
      if (
        !segment ||
        !issueTypes.includes(issue.type) ||
        typeof issue.note !== 'string' ||
        !issue.note.trim()
      ) {
        throw new Error('Scoring returned an issue without valid transcript evidence.');
      }
      return {
        type: issue.type,
        timestampSeconds: Math.max(0, Math.floor(segment.start)),
        note: issue.note.trim().slice(0, 500),
      };
    });

    call.transcript = transcription.text || segments.map((segment) => segment.text).join(' ');
    call.durationSeconds = Math.round(transcription.duration || segments.at(-1).start);
    call.aiScore = result.score;
    call.flaggedIssues = flaggedIssues;
    call.status = 'completed';
    call.processingError = '';
    call.analysis = {
      provider: 'OpenAI',
      transcriptionModel,
      scoringModel,
      completedAt: new Date(),
    };
    await call.save();
  } catch (error) {
    console.error(`Call analysis failed for ${callId}:`, error.message);
    await Call.findOneAndUpdate(
      { _id: callId, status: 'processing' },
      {
        $set: {
          status: 'failed',
          processingError: 'Transcription or scoring failed. Check server logs and retry.',
        },
      },
    );
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.post('/api/calls/upload', audioUpload.single('recording'), async (req, res, next) => {
  try {
    const { agentId, agentName, customer, callAt } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Choose an audio recording to upload.' });
    if (
      ![agentId, agentName, customer].every((value) => typeof value === 'string' && value.trim())
    ) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Agent ID, agent name, and customer are required.' });
    }
    const timestamp = callAt ? new Date(callAt) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Call date is invalid.' });
    }

    const call = await Call.create({
      agentId: agentId.trim(),
      agentName: agentName.trim(),
      customer: customer.trim(),
      durationSeconds: 0,
      callAt: timestamp,
      aiScore: null,
      status: 'uploaded',
      recording: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
    if (process.env.OPENAI_API_KEY) {
      call.status = 'processing';
      await call.save();
      void analyzeCall(String(call._id));
    }
    res.status(201).json(serializeCall(call));
  } catch (error) {
    if (req.file) unlinkSync(req.file.path);
    next(error);
  }
});

app.post('/api/calls/:id/analyze', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid call ID.' });
    if (!process.env.OPENAI_API_KEY)
      return res
        .status(503)
        .json({ error: 'Set OPENAI_API_KEY in .env to run transcription and scoring.' });
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found.' });
    if (!call.recording)
      return res.status(400).json({ error: 'This call has no uploaded recording.' });
    if (call.status === 'processing')
      return res.status(409).json({ error: 'Analysis is already running for this call.' });
    if (call.status === 'completed')
      return res.status(409).json({ error: 'This call has already been scored.' });
    call.status = 'processing';
    call.processingError = '';
    await call.save();
    void analyzeCall(String(call._id));
    res.status(202).json(serializeCall(call));
  } catch (error) {
    next(error);
  }
});

app.get('/api/calls', async (req, res, next) => {
  try {
    const { agent, minScore, maxScore, flagged, sort = 'callAt', order = 'desc' } = req.query;
    const filter = {};
    if (agent) filter.agentId = agent;
    const minimum = minScore === undefined ? undefined : Number(minScore);
    const maximum = maxScore === undefined ? undefined : Number(maxScore);
    if (
      [minimum, maximum].some(
        (value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100),
      ) ||
      minimum > maximum
    ) {
      return res.status(400).json({
        error: 'Score filters must be between 0 and 100, with minimum no greater than maximum.',
      });
    }
    if (minScore !== undefined || maxScore !== undefined) {
      filter.aiScore = {};
      if (minimum !== undefined) filter.aiScore.$gte = minimum;
      if (maximum !== undefined) filter.aiScore.$lte = maximum;
    }
    if (flagged !== undefined && !['true', 'false'].includes(flagged))
      return res.status(400).json({ error: 'Flagged filter must be true or false.' });
    if (flagged === 'true') filter['flaggedIssues.0'] = { $exists: true };
    if (flagged === 'false') filter.flaggedIssues = { $size: 0 };
    const sortFields = {
      callAt: 'callAt',
      aiScore: 'aiScore',
      agent: 'agentName',
      managerScore: 'managerScore',
      flags: 'issues',
    };
    const sortBy = sortFields[sort] ?? 'callAt';
    const direction = order === 'asc' ? 1 : -1;
    const calls = (await Call.find(filter).lean()).map(serializeCall);
    calls.sort((left, right) => {
      let leftValue = left[sortBy];
      let rightValue = right[sortBy];
      if (sortBy === 'issues') {
        leftValue = left.issues.length;
        rightValue = right.issues.length;
      }
      if (leftValue === null || rightValue === null) {
        if (leftValue === rightValue) return 0;
        return leftValue === null ? 1 : -1;
      }
      const result =
        typeof leftValue === 'string'
          ? leftValue.localeCompare(rightValue)
          : leftValue - rightValue;
      return result * direction;
    });
    res.json(calls);
  } catch (error) {
    next(error);
  }
});

app.get('/api/calls/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid call ID.' });
    const call = await Call.findById(req.params.id).lean();
    if (!call) return res.status(404).json({ error: 'Call not found.' });
    res.json({ ...serializeCall(call, { includeTranscript: true }), reviews: call.reviews });
  } catch (error) {
    next(error);
  }
});

app.post('/api/calls/:id/reviews', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid call ID.' });
    const { score, note = '', issueDecisions = [] } = req.body;
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'Score must be a whole number from 0 to 100.' });
    }
    if (typeof note !== 'string' || note.length > 2000 || !Array.isArray(issueDecisions)) {
      return res.status(400).json({ error: 'Review note or issue decisions are invalid.' });
    }
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found.' });
    const issueIds = new Set(call.flaggedIssues.map((issue) => String(issue._id)));
    const decisions = [];
    for (const item of issueDecisions) {
      if (!issueIds.has(String(item.issueId)) || !['valid', 'invalid'].includes(item.status)) {
        return res.status(400).json({
          error: 'Each issue decision must reference a call issue and be valid or invalid.',
        });
      }
      decisions.push({ issueId: item.issueId, status: item.status });
    }
    call.reviews.push({
      version: call.reviews.length + 1,
      score,
      note: note.trim(),
      issueDecisions: decisions,
    });
    await call.save();
    res
      .status(201)
      .json({ ...serializeCall(call, { includeTranscript: true }), reviews: call.reviews });
  } catch (error) {
    next(error);
  }
});

app.get('/api/agents', async (_req, res, next) => {
  try {
    const agents = await Call.aggregate([
      { $group: { _id: '$agentId', name: { $first: '$agentName' }, callCount: { $sum: 1 } } },
      { $sort: { name: 1 } },
    ]);
    res.json(
      agents.map((agent) => ({ id: agent._id, name: agent.name, callCount: agent.callCount })),
    );
  } catch (error) {
    next(error);
  }
});

app.get('/api/agents/:agentId/analytics', async (req, res, next) => {
  try {
    const filter = { agentId: req.params.agentId };
    if (req.query.from || req.query.to) {
      filter.callAt = {};
      if (req.query.from) filter.callAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        filter.callAt.$lte = new Date(req.query.to);
        if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
          filter.callAt.$lte.setUTCHours(23, 59, 59, 999);
      }
      if (
        Number.isNaN(filter.callAt.$gte?.getTime()) ||
        Number.isNaN(filter.callAt.$lte?.getTime())
      ) {
        return res.status(400).json({ error: 'Date range is invalid.' });
      }
    }
    const calls = (await Call.find(filter).sort({ callAt: 1 }).lean())
      .map(serializeCall)
      .filter((call) => Number.isFinite(call.aiScore));
    if (!calls.length)
      return res.status(404).json({ error: 'No calls found for this agent and date range.' });
    const counts = new Map();
    const flaggedCounts = new Map();
    for (const call of calls)
      for (const issue of call.issues) {
        flaggedCounts.set(issue.type, (flaggedCounts.get(issue.type) ?? 0) + 1);
        if (issue.status === 'valid') counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
      }
    const managerScores = calls.map((call) => call.managerScore).filter((score) => score !== null);
    res.json({
      agentId: req.params.agentId,
      agentName: calls[0].agentName,
      callCount: calls.length,
      reviewedCount: managerScores.length,
      averageAiScore: Math.round(calls.reduce((sum, call) => sum + call.aiScore, 0) / calls.length),
      averageManagerScore: managerScores.length
        ? Math.round(managerScores.reduce((sum, score) => sum + score, 0) / managerScores.length)
        : null,
      issueCounts: [...counts]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      flaggedIssueCounts: [...flaggedCounts]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      trend: calls.map((call) => ({
        date: call.callAt,
        aiScore: call.aiScore,
        managerScore: call.managerScore,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Recording must be 100 MB or smaller.' });
  }
  if (error.message.startsWith('Upload an ')) return res.status(400).json({ error: error.message });
  res.status(500).json({ error: 'Something went wrong. Check the server logs.' });
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agentscore')
  .then(() =>
    app.listen(port, () => console.log(`AgentScore API listening on http://localhost:${port}`)),
  )
  .catch((error) => {
    console.error(
      'Could not connect to MongoDB. Set MONGODB_URI in .env and start MongoDB.',
      error.message,
    );
    process.exit(1);
  });
