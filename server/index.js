import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Call from './models/Call.js';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '32kb' }));

const latestReview = (call) => call.reviews.at(-1) ?? null;

function serializeCall(call) {
  const review = latestReview(call);
  const decisions = new Map((review?.issueDecisions ?? []).map((item) => [String(item.issueId), item.status]));
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
    issues: call.flaggedIssues.map((issue) => ({
      id: String(issue._id),
      type: issue.type,
      timestampSeconds: issue.timestampSeconds,
      note: issue.note,
      status: decisions.get(String(issue._id)) ?? 'pending',
    })),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/calls', async (req, res, next) => {
  try {
    const { agent, minScore, maxScore, flagged, sort = 'callAt', order = 'desc' } = req.query;
    const filter = {};
    if (agent) filter.agentId = agent;
    const minimum = minScore === undefined ? undefined : Number(minScore);
    const maximum = maxScore === undefined ? undefined : Number(maxScore);
    if ([minimum, maximum].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) || minimum > maximum) {
      return res.status(400).json({ error: 'Score filters must be between 0 and 100, with minimum no greater than maximum.' });
    }
    if (minScore !== undefined || maxScore !== undefined) {
      filter.aiScore = {};
      if (minimum !== undefined) filter.aiScore.$gte = minimum;
      if (maximum !== undefined) filter.aiScore.$lte = maximum;
    }
    if (flagged !== undefined && !['true', 'false'].includes(flagged)) return res.status(400).json({ error: 'Flagged filter must be true or false.' });
    if (flagged === 'true') filter['flaggedIssues.0'] = { $exists: true };
    if (flagged === 'false') filter.flaggedIssues = { $size: 0 };
      const sortFields = { callAt: 'callAt', aiScore: 'aiScore', agent: 'agentName', managerScore: 'managerScore', flags: 'issues' };
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
        const result = typeof leftValue === 'string'
          ? leftValue.localeCompare(rightValue)
          : leftValue - rightValue;
        return result * direction;
      });
      res.json(calls);
  } catch (error) { next(error); }
});

app.get('/api/calls/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid call ID.' });
    const call = await Call.findById(req.params.id).lean();
    if (!call) return res.status(404).json({ error: 'Call not found.' });
    res.json({ ...serializeCall(call), reviews: call.reviews });
  } catch (error) { next(error); }
});

app.post('/api/calls/:id/reviews', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid call ID.' });
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
        return res.status(400).json({ error: 'Each issue decision must reference a call issue and be valid or invalid.' });
      }
      decisions.push({ issueId: item.issueId, status: item.status });
    }
    call.reviews.push({ version: call.reviews.length + 1, score, note: note.trim(), issueDecisions: decisions });
    await call.save();
    res.status(201).json({ ...serializeCall(call), reviews: call.reviews });
  } catch (error) { next(error); }
});

app.get('/api/agents', async (_req, res, next) => {
  try {
    const agents = await Call.aggregate([
      { $group: { _id: '$agentId', name: { $first: '$agentName' }, callCount: { $sum: 1 } } },
      { $sort: { name: 1 } },
    ]);
    res.json(agents.map((agent) => ({ id: agent._id, name: agent.name, callCount: agent.callCount })));
  } catch (error) { next(error); }
});

app.get('/api/agents/:agentId/analytics', async (req, res, next) => {
  try {
    const filter = { agentId: req.params.agentId };
    if (req.query.from || req.query.to) {
      filter.callAt = {};
      if (req.query.from) filter.callAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        filter.callAt.$lte = new Date(req.query.to);
        if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) filter.callAt.$lte.setUTCHours(23, 59, 59, 999);
      }
      if (Number.isNaN(filter.callAt.$gte?.getTime()) || Number.isNaN(filter.callAt.$lte?.getTime())) {
        return res.status(400).json({ error: 'Date range is invalid.' });
      }
    }
    const calls = (await Call.find(filter).sort({ callAt: 1 }).lean()).map(serializeCall);
    if (!calls.length) return res.status(404).json({ error: 'No calls found for this agent and date range.' });
    const counts = new Map();
    const flaggedCounts = new Map();
    for (const call of calls) for (const issue of call.issues) {
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
      averageManagerScore: managerScores.length ? Math.round(managerScores.reduce((sum, score) => sum + score, 0) / managerScores.length) : null,
      issueCounts: [...counts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      flaggedIssueCounts: [...flaggedCounts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      trend: calls.map((call) => ({ date: call.callAt, aiScore: call.aiScore, managerScore: call.managerScore })),
    });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Check the server logs.' });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agentscore')
  .then(() => app.listen(port, () => console.log(`AgentScore API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('Could not connect to MongoDB. Set MONGODB_URI in .env and start MongoDB.', error.message);
    process.exit(1);
  });