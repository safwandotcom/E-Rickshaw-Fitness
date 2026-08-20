import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { drafts, removeDraft, saveDraft } from './offline';
import { verifyOffline } from './qr';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type View = 'inspection' | 'verification' | 'admin';
type KeyRecord = { key_id: string; public_key_pem: string };
type Summary = { rickshaws: number; inspections: number; paid_bills: number; active_certificates: number; queued_notifications: number };

function App() {
  const [view, setView] = useState<View>('inspection');
  const [message, setMessage] = useState('Ready. Sign in through the authority identity service before field use.');
  const [token, setToken] = useState('');
  const [certificate, setCertificate] = useState('');
  const [verification, setVerification] = useState('');
  const [pending, setPending] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function refreshPending() { setPending((await drafts()).length); }
  useEffect(() => { void refreshPending(); if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/service-worker.js'); }, []);

  const auth = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>), [token]);
  async function loadSummary() {
    if (!token) { setSummary(null); return; }
    setSummaryLoading(true);
    try {
      const response = await fetch(`${API}/api/v1/admin/reports/summary`, { headers: auth });
      if (!response.ok) { setSummary(null); setMessage(`Could not load operations summary: ${await response.text()}`); return; }
      const body = await response.json() as { data: Summary };
      setSummary(body.data);
    } catch (error) {
      setSummary(null);
      setMessage(`Could not load operations summary: ${error instanceof Error ? error.message : 'network error'}`);
    } finally { setSummaryLoading(false); }
  }
  useEffect(() => { if (view === 'admin' && token) void loadSummary(); }, [view, token]);
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
  async function provisionUser(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch(`${API}/api/v1/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ external_subject: values.external_subject, display_name: values.display_name, roles: [values.role], scopes: values.district_id && values.zone_id ? [{ district_id: values.district_id, zone_id: values.zone_id }] : [] }) });
    setMessage(response.ok ? 'User provisioned successfully.' : `Provisioning failed: ${await response.text()}`);
  }
  return <main>
    <header><h1>E-Rickshaw Fitness</h1><p>Inspector & roadside verification PWA</p></header>
    <nav><button onClick={() => setView('inspection')}>Inspection</button><button onClick={() => setView('verification')}>Verify QR</button><button onClick={() => setView('admin')}>Admin</button></nav>
    <section className="notice">{message} Offline queue: {pending}</section>
    <label>Access token (development only)<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Bearer token" /></label>
    {view === 'inspection' ? <section><h2>Submit fitness inspection</h2><form onSubmit={(event) => { event.preventDefault(); void submitInspection(event.currentTarget); }}>
      <label>Rickshaw UUID<input name="rickshaw_id" required /></label><label>Checklist template UUID<input name="template_id" required /></label>
      <label>Brakes<select name="brakes"><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label>Lights<select name="lights"><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <label>Notes<textarea name="notes" /></label><label>Result<select name="result"><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <button type="submit">Submit / save offline</button><button type="button" onClick={() => void syncDrafts()}>Sync saved inspections</button>
    </form></section> : view === 'verification' ? <section><h2>Offline certificate check</h2><label>QR payload<textarea value={certificate} onChange={(event) => setCertificate(event.target.value)} placeholder="ERF1...." /></label><button onClick={() => void verifyCertificate()}>Verify signature</button><p className="result">{verification}</p></section> : <>
      <section><h2>Provision OIDC user</h2><p>Central administrator access is required.</p><form onSubmit={(event) => { event.preventDefault(); void provisionUser(event.currentTarget); }}><label>External identity subject<input name="external_subject" required placeholder="identity-provider subject" /></label><label>Display name<input name="display_name" required /></label><label>Role<select name="role"><option value="inspector">Inspector</option><option value="hub_supervisor">Hub supervisor</option><option value="district_administrator">District administrator</option><option value="finance_operator">Finance operator</option><option value="traffic_police_verifier">Traffic police verifier</option></select></label><label>District UUID<input name="district_id" /></label><label>Zone UUID<input name="zone_id" /></label><button type="submit">Provision user</button></form></section>
      <section><div className="section-heading"><div><h2>Operations summary</h2><p className="muted">Counts are limited to your assigned district scope.</p></div><button type="button" onClick={() => void loadSummary()} disabled={summaryLoading}>{summaryLoading ? 'Refreshing…' : 'Refresh summary'}</button></div>{summary ? <div className="summary-grid">{([['rickshaws', 'Registered rickshaws'], ['inspections', 'Inspections'], ['paid_bills', 'Paid bills'], ['active_certificates', 'Active certificates'], ['queued_notifications', 'Queued notifications']] as Array<[keyof Summary, string]>).map(([key, label]) => <div className="summary-card" key={key}><span>{label}</span><strong>{summary[key].toLocaleString()}</strong></div>)}</div> : <p className="muted">Enter an access token with an administrative or finance role to load the summary.</p>}</section>
    </>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
