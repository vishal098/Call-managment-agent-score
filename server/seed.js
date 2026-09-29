import 'dotenv/config';
import mongoose from 'mongoose';
import Call from './models/Call.js';

const agents = [
  ['AG-1042', 'Maya Chen'],
  ['AG-1098', 'Jordan Ellis'],
  ['AG-1126', 'Priya Patel'],
  ['AG-1184', 'Marcus Reed'],
  ['AG-1210', 'Elena Vasquez'],
  ['AG-1263', 'Sam Okafor'],
];
const issueTemplates = [
  ['Compliance', 'Required disclosure was incomplete.'],
  ['Tone', 'Customer was interrupted during their explanation.'],
  ['Script adherence', 'Verification step was not completed.'],
  ['Resolution', 'No clear next step was offered to the customer.'],
  ['Empathy', 'Customer concern was not acknowledged.'],
];
const customers = [
  'Alex Morgan',
  'Taylor Brooks',
  'Casey Rivera',
  'Avery Kim',
  'Jamie Bennett',
  'Riley Cooper',
  'Drew Parker',
  'Cameron Lane',
];
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agentscore');
  await Call.deleteMany({ seeded: true });
  const now = Date.now();
  const calls = Array.from({ length: 42 }, (_, index) => {
    const [agentId, agentName] = pick(agents);
    const durationSeconds = randomInt(185, 1260);
    const flaggedIssues = Array.from({ length: randomInt(0, 3) }, () => {
      const template = pick(issueTemplates);
      return {
        type: template[0],
        timestampSeconds: randomInt(12, durationSeconds - 8),
        note: template[1],
      };
    });
    const aiScore = randomInt(58, 99);
    const callAt = new Date(now - randomInt(0, 27) * 86_400_000 - index * 11_400_000);
    const call = new Call({
      agentId,
      agentName,
      customer: pick(customers),
      durationSeconds,
      callAt,
      aiScore,
      flaggedIssues,
      seeded: true,
    });
    if (Math.random() > 0.63) {
      const issueDecisions = call.flaggedIssues.map((issue) => ({
        issueId: issue._id,
        status: Math.random() > 0.2 ? 'valid' : 'invalid',
      }));
      call.reviews.push({
        version: 1,
        score: Math.max(0, Math.min(100, aiScore + randomInt(-12, 8))),
        note: pick([
          'Good rapport; missed one small check.',
          'Score adjusted to reflect the conversation.',
          'Coaching opportunity noted for next review.',
          '',
        ]),
        reviewedAt: new Date(callAt.getTime() + randomInt(1, 72) * 3_600_000),
        issueDecisions,
      });
    }
    return call;
  });
  await Call.insertMany(calls);
  console.log(`Seeded ${calls.length} calls across ${agents.length} agents.`);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
