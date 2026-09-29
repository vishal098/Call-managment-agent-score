import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Check,
  CheckCheck,
  Clock3,
  Headphones,
  ShieldCheck,
  X,
} from 'lucide-react';
import Score from './Score.jsx';
import { formatDate, formatDuration, scoreColor } from '../utils/formatters.js';

function ReviewPanel({ call, onClose, onSubmit, onAnalyze, startingAnalysis }) {
  const [score, setScore] = useState(call.managerScore ?? call.aiScore);
  const [note, setNote] = useState(call.reviews?.at(-1)?.note ?? '');
  const [decisions, setDecisions] = useState(() =>
    Object.fromEntries(
      call.issues.map((issue) => [issue.id, issue.status === 'pending' ? 'valid' : issue.status]),
    ),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        score: Number(score),
        note,
        issueDecisions: call.issues.map((issue) => ({
          issueId: issue.id,
          status: decisions[issue.id],
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="review-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <div className="panel-topline">
          <span>
            <span className="panel-dot" />
            CALL REVIEW
          </span>
          <button onClick={onClose} aria-label="Close review">
            <X size={19} />
          </button>
        </div>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">
              {call.agentId} <span className="crumb-slash">/</span>{' '}
              {formatDate(call.callAt, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <h2 id="review-title">{call.agentName}</h2>
            <p>Customer conversation with {call.customer}</p>
          </div>
        </div>
        <div className="call-meta-strip">
          <span>
            <Clock3 size={15} />
            {call.durationSeconds ? formatDuration(call.durationSeconds) : 'Duration pending'}
          </span>
          <span>
            <Headphones size={15} />
            Inbound call
          </span>
          <span>
            <AudioLines size={15} />
            {call.recording?.originalName ?? 'Call recording'}
          </span>
        </div>
        {call.aiScore === null ? (
          <div className="analysis-pending">
            <span className="processing-badge">
              {call.status === 'failed'
                ? 'Analysis failed'
                : call.status === 'processing'
                  ? 'Analysis running'
                  : 'Awaiting analysis'}
            </span>
            <h3>Recording received</h3>
            <p>
              {call.status === 'failed'
                ? call.processingError || 'Analysis could not be completed.'
                : call.status === 'processing'
                  ? 'Transcription and scoring are in progress. This panel will update automatically.'
                  : 'Transcription and AI scoring have not run for this upload yet.'}
            </p>
            {call.recording?.url && (
              <audio controls preload="metadata" src={call.recording.url}>
                Audio preview is not supported by this browser.
              </audio>
            )}
            {call.status !== 'processing' && (
              <button className="analysis-action" onClick={onAnalyze} disabled={startingAnalysis}>
                {startingAnalysis
                  ? 'Starting…'
                  : call.status === 'failed'
                    ? 'Retry analysis'
                    : 'Run AI analysis'}
                <Activity size={15} />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="score-comparison">
              <div>
                <span>AI QUALITY SCORE</span>
                <div>
                  <Score value={call.aiScore} />
                </div>
                <small>Original score · never overwritten</small>
              </div>
              <div className="comparison-divider">
                <ArrowLeft size={17} />
              </div>
              <div>
                <span>MANAGER SCORE</span>
                <div>
                  {call.managerScore === null ? (
                    <strong className="score-empty">—</strong>
                  ) : (
                    <Score value={call.managerScore} />
                  )}
                </div>
                <small>
                  {call.managerScore === null
                    ? 'Awaiting review'
                    : `Latest of ${call.reviewCount} review${call.reviewCount === 1 ? '' : 's'}`}
                </small>
              </div>
            </div>
            {call.transcript && (
              <details className="transcript-details">
                <summary>View transcript</summary>
                <p>{call.transcript}</p>
              </details>
            )}
            <form className="review-form" onSubmit={save}>
              <section className="review-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">01 / ISSUE CHECK</span>
                    <h3>
                      AI-flagged moments <span>{call.issues.length}</span>
                    </h3>
                  </div>
                  <span className="issue-hint">Your call, your judgment</span>
                </div>
                {call.issues.length === 0 ? (
                  <div className="no-issues">
                    <ShieldCheck size={20} />
                    <span>
                      <strong>Nothing flagged</strong>
                      <small>The AI found no issues on this call.</small>
                    </span>
                  </div>
                ) : (
                  <div className="issue-list">
                    {call.issues.map((issue) => (
                      <div className="issue-card" key={issue.id}>
                        <div className="issue-top">
                          <span className="issue-type">{issue.type}</span>
                          <span className="issue-time">
                            {formatDuration(issue.timestampSeconds)}
                          </span>
                        </div>
                        <p>{issue.note}</p>
                        <div className="decision-group">
                          <button
                            type="button"
                            className={
                              decisions[issue.id] === 'valid'
                                ? 'decision-active decision-valid'
                                : ''
                            }
                            onClick={() => setDecisions({ ...decisions, [issue.id]: 'valid' })}
                          >
                            <Check size={14} />
                            Confirm
                          </button>
                          <button
                            type="button"
                            className={
                              decisions[issue.id] === 'invalid'
                                ? 'decision-active decision-invalid'
                                : ''
                            }
                            onClick={() => setDecisions({ ...decisions, [issue.id]: 'invalid' })}
                          >
                            <X size={14} />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="review-section score-editor-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">02 / YOUR ASSESSMENT</span>
                    <h3>Manager score</h3>
                  </div>
                  <span className={`score-preview ${scoreColor(Number(score))}`}>
                    {score}
                    <small>/100</small>
                  </span>
                </div>
                <div className="range-wrap">
                  <input
                    aria-label="Manager score"
                    type="range"
                    min="0"
                    max="100"
                    value={score}
                    style={{ '--range-progress': `${score}%` }}
                    onChange={(event) => setScore(event.target.value)}
                  />
                  <div className="range-labels">
                    <span>0 · Needs coaching</span>
                    <span>Exceptional · 100</span>
                  </div>
                </div>
              </section>
              <section className="review-section note-section">
                <label htmlFor="review-note">
                  <span className="section-kicker">03 / COACHING CONTEXT</span>
                  <h3>
                    Manager note <span className="optional-label">OPTIONAL</span>
                  </h3>
                </label>
                <textarea
                  id="review-note"
                  rows="3"
                  maxLength="2000"
                  placeholder="Add context for the next coaching conversation..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="char-count">{note.length} / 2,000</div>
              </section>
              {call.reviews?.length > 0 && (
                <section className="history-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">AUDIT TRAIL</span>
                      <h3>Previous reviews</h3>
                    </div>
                    <CheckCheck size={17} />
                  </div>
                  {[...call.reviews].reverse().map((review) => (
                    <div className="history-row" key={review._id ?? review.version}>
                      <span className="history-version">v{review.version}</span>
                      <span>
                        <strong>{review.score}/100</strong>
                        <small>
                          {formatDate(review.reviewedAt, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </small>
                      </span>
                    </div>
                  ))}
                </section>
              )}
              <div className="panel-submit">
                <span>AI score stays in the audit record.</span>
                <button type="submit" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : call.reviewCount
                      ? 'Save new review'
                      : 'Save manager review'}
                  <ArrowLeft size={15} />
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}

export default ReviewPanel;
