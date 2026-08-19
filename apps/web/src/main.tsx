import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { drafts, removeDraft, saveDraft } from './offline';
import { verifyOffline } from './qr';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type View = 'inspection' | 'verification';
type KeyRecord = { key_id: string; public_key_pem: string };

function App() {
  const [view, setView] = useState<View>('inspection');
  const [message, setMessage] = useState('Ready. Sign in through the authority identity service before field use.');
  const [token, setToken] = useState('');
  const [certificate, setCertificate] = useState('');
  const [verification, setVerification] = useState('');
  const [pending, setPending] = useState(0);

  async function refreshPending() { setPending((await drafts()).length); }
  useEffect(() => { void refreshPending(); if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/service-worker.js'); }, []);

  const auth = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>), [token]);
  async function submitInspection(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form));
    const payload = { rickshaw_id: values.rickshaw_id, template_id: values.template_id, checklist_data: { brakes: values.brakes === 'pass', lights: values.lights === 'pass', notes: values.notes }, result: values.result, client_timestamp: new Date().toISOString() };
    if (!navigator.onLine || !token) {
      await saveDraft(payload); await refreshPending(); setMessage('Inspection safely saved on this device. It must be synced after authenticated connectivity returns.'); return;
    }
    const response = await fetch(`${API}/api/v1/inspections`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(payload) });
    setMessage(response.ok ? 'Inspection submitted. Payment instructions will be queued for passing vehicles.' : `Submission failed: ${await response.text()}`);
  }
  async function syncDrafts() {
    if (!token || !navigator.onLine) { setMessage('Connect to the internet and sign in before syncing.'); return; }
    for (const draft of await drafts()) {
      const response = await fetch(`${API}/api/v1/inspections`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth, 'Idempotency-Key': draft.id }, body: JSON.stringify(draft.payload) });
      if (response.ok) await removeDraft(draft.id);
    }
    await refreshPending(); setMessage('Offline outbox synchronization completed.');
  }
  async function verifyCertificate() {
    const stored = localStorage.getItem('erf-public-keys');
    let keys: KeyRecord[] = stored ? JSON.parse(stored) as KeyRecord[] : [];
    if (navigator.onLine) {
      const response = await fetch(`${API}/api/v1/verifier/keys`);
      if (response.ok) { keys = (await response.json() as { data: KeyRecord[] }).data; localStorage.setItem('erf-public-keys', JSON.stringify(keys)); }
    }
    const result = await verifyOffline(certificate, keys[0]?.public_key_pem ?? '');
    setVerification(result.valid ? `Offline signature valid. ${navigator.onLine ? 'Use online lookup for revocation status.' : 'Live revocation status unavailable.'}` : `Not valid: ${result.reason ?? 'unknown reason'}`);
  }
  return <main>
    <header><h1>E-Rickshaw Fitness</h1><p>Inspector & roadside verification PWA</p></header>
    <nav><button onClick={() => setView('inspection')}>Inspection</button><button onClick={() => setView('verification')}>Verify QR</button></nav>
    <section className="notice">{message} Offline queue: {pending}</section>
    <label>Access token (development only)<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Bearer token" /></label>
    {view === 'inspection' ? <section><h2>Submit fitness inspection</h2><form onSubmit={(event) => { event.preventDefault(); void submitInspection(event.currentTarget); }}>
      <label>Rickshaw UUID<input name="rickshaw_id" required /></label><label>Checklist template UUID<input name="template_id" required /></label>
      <label>Brakes<select name="brakes"><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label>Lights<select name="lights"><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <label>Notes<textarea name="notes" /></label><label>Result<select name="result"><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <button type="submit">Submit / save offline</button><button type="button" onClick={() => void syncDrafts()}>Sync saved inspections</button>
    </form></section> : <section><h2>Offline certificate check</h2><label>QR payload<textarea value={certificate} onChange={(event) => setCertificate(event.target.value)} placeholder="ERF1...." /></label><button onClick={() => void verifyCertificate()}>Verify signature</button><p className="result">{verification}</p></section>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
