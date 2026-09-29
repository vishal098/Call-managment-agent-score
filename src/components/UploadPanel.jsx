import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';

function UploadPanel({ agents, onClose, onSubmit }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [customer, setCustomer] = useState('');
  const [recording, setRecording] = useState(null);
  const [callAt, setCallAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    const agent = agents.find((item) => item.id === agentId);
    if (!agent || !recording) return;
    setUploading(true);
    try {
      await onSubmit({
        agentId,
        agentName: agent.name,
        customer,
        callAt: new Date(callAt).toISOString(),
        recording,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="review-panel upload-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <div className="panel-topline">
          <span>
            <span className="panel-dot" />
            NEW RECORDING
          </span>
          <button onClick={onClose} aria-label="Close upload">
            <X size={19} />
          </button>
        </div>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CALL INTAKE</div>
            <h2 id="upload-title">Upload a recording</h2>
            <p>The call will appear in the queue awaiting analysis.</p>
          </div>
        </div>
        <form className="upload-form" onSubmit={submit}>
          <label>
            Agent
            <select required value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              <option value="" disabled>
                Select agent
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer
            <input
              required
              maxLength="120"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder="Customer name"
            />
          </label>
          <label>
            Call date and time
            <input
              required
              type="datetime-local"
              value={callAt}
              onChange={(event) => setCallAt(event.target.value)}
            />
          </label>
          <label>
            Audio file
            <input
              required
              type="file"
              accept=".aac,.flac,.m4a,.mp3,.ogg,.wav,.webm,audio/*"
              onChange={(event) => setRecording(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="upload-help">MP3, WAV, M4A, AAC, FLAC, OGG, or WEBM · Maximum 100 MB</p>
          <div className="upload-submit">
            <button type="submit" disabled={uploading || !agents.length}>
              {uploading ? 'Uploading…' : 'Upload recording'}
              <Upload size={15} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default UploadPanel;
