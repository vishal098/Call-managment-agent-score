import { useCallback, useEffect, useState } from 'react';
import AgentDashboard from './components/AgentDashboard.jsx';
import CallQueue from './components/CallQueue.jsx';
import ReviewPanel from './components/ReviewPanel.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import WorkspaceShell from './components/WorkspaceShell.jsx';

const getJson = async (url, options) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (HTTP ${response.status}).`);
  return body;
};
function App() {
  const [view, setView] = useState('calls');
  const [calls, setCalls] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [rangeDays, setRangeDays] = useState('30');
  const [filters, setFilters] = useState({ agent: '', minScore: '', maxScore: '', flagged: '' });
  const [sort, setSort] = useState({ key: 'callAt', order: 'desc' });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadCalls = useCallback(async () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '') params.set(key, value);
    params.set('sort', sort.key);
    params.set('order', sort.order);
    const data = await getJson(`/api/calls?${params}`);
    setCalls(data);
  }, [filters, sort]);

  useEffect(() => {
    getJson('/api/agents')
      .then((agentData) => {
        setAgents(agentData);
        if (agentData[0]) setSelectedAgent(agentData[0].id);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    loadCalls()
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [loadCalls]);

  useEffect(() => {
    if (view !== 'agents' || !selectedAgent) return;
    const params = new URLSearchParams();
    if (rangeDays !== 'all') {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - Number(rangeDays));
      params.set('from', from.toISOString().slice(0, 10));
      params.set('to', to.toISOString().slice(0, 10));
    }
    getJson(`/api/agents/${selectedAgent}/analytics?${params}`)
      .then(setAnalytics)
      .catch((reason) => setError(reason.message));
  }, [view, selectedAgent, rangeDays]);

  useEffect(() => {
    if (selected?.status !== 'processing') return;
    const callId = selected.id;
    const timer = setInterval(async () => {
      try {
        const updated = await getJson(`/api/calls/${callId}`);
        setSelected((current) => (current?.id === callId ? updated : current));
        if (updated.status !== 'processing') {
          await loadCalls();
          setNotice(
            updated.status === 'completed'
              ? 'Transcription and AI scoring are complete.'
              : updated.processingError,
          );
        }
      } catch (reason) {
        setError(reason.message);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [selected?.id, selected?.status, loadCalls]);

  const openCall = async (call) => {
    try {
      setSelected(await getJson(`/api/calls/${call.id}`));
      setNotice('');
    } catch (reason) {
      setError(reason.message);
    }
  };

  const submitReview = async (review) => {
    try {
      const updated = await getJson(`/api/calls/${selected.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      });
      setSelected(updated);
      setNotice(`Review v${updated.reviewCount} saved. AI score preserved at ${updated.aiScore}.`);
      await loadCalls();
      if (view === 'agents') {
        const params = new URLSearchParams();
        if (rangeDays !== 'all') {
          const to = new Date();
          const from = new Date();
          from.setDate(from.getDate() - Number(rangeDays));
          params.set('from', from.toISOString().slice(0, 10));
          params.set('to', to.toISOString().slice(0, 10));
        }
        setAnalytics(await getJson(`/api/agents/${selectedAgent}/analytics?${params}`));
      }
    } catch (reason) {
      setError(reason.message);
    }
  };

  const uploadCall = async ({ agentId, agentName, customer, callAt, recording }) => {
    const formData = new FormData();
    formData.set('agentId', agentId);
    formData.set('agentName', agentName);
    formData.set('customer', customer);
    formData.set('callAt', callAt);
    formData.set('recording', recording);
    try {
      const uploaded = await getJson('/api/calls/upload', { method: 'POST', body: formData });
      await loadCalls();
      setSelected(await getJson(`/api/calls/${uploaded.id}`));
      setUploadOpen(false);
      setNotice(
        uploaded.status === 'processing'
          ? 'Recording uploaded. Transcription and scoring started.'
          : 'Recording uploaded. Set OPENAI_API_KEY to start transcription and scoring.',
      );
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  };

  const startAnalysis = async (callId) => {
    setStartingAnalysis(true);
    try {
      const updated = await getJson(`/api/calls/${callId}/analyze`, { method: 'POST' });
      setSelected(updated);
      setNotice('Transcription and AI scoring started.');
      setError('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setStartingAnalysis(false);
    }
  };

  const changeSort = (key) =>
    setSort((previous) => ({
      key,
      order: previous.key === key && previous.order === 'desc' ? 'asc' : 'desc',
    }));

  return (
    <WorkspaceShell
      view={view}
      callsCount={calls.length}
      query={query}
      onQueryChange={setQuery}
      error={error}
      notice={notice}
      onDismissError={() => setError('')}
      onDismissNotice={() => setNotice('')}
      onShowCalls={() => {
        setView('calls');
        setSelected(null);
      }}
      onShowAgents={() => {
        setView('agents');
        setSelected(null);
      }}
      overlays={
        <>
          {selected && (
            <ReviewPanel
              call={selected}
              onClose={() => setSelected(null)}
              onSubmit={submitReview}
              onAnalyze={() => startAnalysis(selected.id)}
              startingAnalysis={startingAnalysis}
            />
          )}
          {uploadOpen && (
            <UploadPanel
              agents={agents}
              onClose={() => setUploadOpen(false)}
              onSubmit={uploadCall}
            />
          )}
        </>
      }
    >
      {view === 'calls' ? (
        <CallQueue
          calls={calls}
          agents={agents}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          onChangeSort={changeSort}
          query={query}
          setQuery={setQuery}
          loading={loading}
          selectedCallId={selected?.id}
          onOpenCall={openCall}
          onResetFilters={() => {
            setFilters({ agent: '', minScore: '', maxScore: '', flagged: '' });
            setQuery('');
          }}
          onUpload={() => {
            setUploadOpen(true);
            setError('');
          }}
        />
      ) : (
        <AgentDashboard
          agents={agents}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          analytics={analytics}
          rangeDays={rangeDays}
          setRangeDays={setRangeDays}
        />
      )}
    </WorkspaceShell>
  );
}

export default App;
