import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beginSignIn, completeSignIn, readOidcConfig } from './auth';
import { drafts, removeDraft, saveDraft } from './offline';
import { verifyOffline } from './qr';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type View = 'inspection' | 'verification' | 'admin';
type KeyRecord = { key_id: string; public_key_pem: string };
type Summary = { rickshaws: number; inspections: number; paid_bills: number; active_certificates: number; queued_notifications: number };
type ReconciliationRow = { bill_code: string; bill_status: string; bill_amount_paisa: number; bill_expires_at: string; provider: string | null; provider_transaction_id: string | null; payment_status: string | null; payment_amount_paisa: number | null; payment_at: string | null };
type LiveVerification = { valid: boolean; certificate_number?: string; chassis_suffix?: string; zone?: string; expires_at?: string; status?: string; reason?: string };
type ChecklistField = { key: string; label: string; label_bn?: string; type: 'pass_fail_na' | 'text' };
type InspectionTemplate = { id: string; version: string; vehicle_type: string; schema_json?: { fields?: ChecklistField[] }; effective_from?: string; effective_to?: string | null };
type Rickshaw = { id: string; chassis_number: string; motor_number?: string | null; district_id: string; zone_id: string; status: string };

function App() {
  const [view, setView] = useState<View>('inspection');
  const [message, setMessage] = useState('Ready. Sign in through the authority identity service before field use.');
  const [token, setToken] = useState('');
  const [certificate, setCertificate] = useState('');
  const [verification, setVerification] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [liveVerification, setLiveVerification] = useState<LiveVerification | null>(null);
  const [liveVerificationLoading, setLiveVerificationLoading] = useState(false);
  const [pending, setPending] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[] | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [templates, setTemplates] = useState<InspectionTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('erf-inspection-templates') ?? '[]') as InspectionTemplate[]; } catch { return []; }
  });
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const activeTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const activeFields = activeTemplate?.schema_json?.fields ?? [];
  useEffect(() => { if (templates[0] && !templates.some((template) => template.id === selectedTemplateId)) setSelectedTemplateId(templates[0].id); }, [templates]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleResult, setVehicleResult] = useState<Rickshaw | null>(null);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const oidcConfig = useMemo(() => readOidcConfig(), []);
  const [signingIn, setSigningIn] = useState(false);

  async function refreshPending() { setPending((await drafts()).length); }
  useEffect(() => {
    void refreshPending();
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/service-worker.js');
    if (!oidcConfig || !window.location.search.includes('code=')) return;
    setSigningIn(true);
    completeSignIn(oidcConfig, window.location.search)
      .then((result) => {
        if (!result) return;
        setToken(result.idToken);
        setMessage('Signed in through the authority identity provider.');
        window.history.replaceState(null, '', window.location.pathname);
      })
      .catch((error) => setMessage(`Sign-in failed: ${error instanceof Error ? error.message : 'unknown error'}`))
      .finally(() => setSigningIn(false));
  }, []);

  const auth = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>), [token]);
  async function loadTemplates() {
    if (!token || !navigator.onLine) return;
    setTemplatesLoading(true);
    try {
      const response = await fetch(`${API}/api/v1/inspections/templates/current`, { headers: auth });
      if (!response.ok) { setMessage(`Could not load inspection templates: ${await response.text()}`); return; }
      const body = await response.json() as { data: InspectionTemplate[] };
      setTemplates(body.data);
      localStorage.setItem('erf-inspection-templates', JSON.stringify(body.data));
    } catch (error) {
      setMessage(`Using cached inspection templates: ${error instanceof Error ? error.message : 'offline'}`);
    } finally { setTemplatesLoading(false); }
  }
  useEffect(() => { if (view === 'inspection' && token) void loadTemplates(); }, [view, token]);
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
  async function loadReconciliation() {
    if (!token) { setReconciliation(null); return; }
    setReconciliationLoading(true);
    try {
      const response = await fetch(`${API}/api/v1/admin/reconciliation`, { headers: auth });
      if (!response.ok) { setReconciliation(null); setMessage(`Could not load reconciliation exceptions: ${await response.text()}`); return; }
      const body = await response.json() as { data: ReconciliationRow[] };
      setReconciliation(body.data);
    } catch (error) {
      setReconciliation(null);
      setMessage(`Could not load reconciliation exceptions: ${error instanceof Error ? error.message : 'network error'}`);
    } finally { setReconciliationLoading(false); }
  }
  useEffect(() => { if (view === 'admin' && token) void loadReconciliation(); }, [view, token]);
  async function submitInspection(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form));
    const checklistData: Record<string, unknown> = {};
    for (const field of activeFields) {
      if (field.type === 'text') { checklistData[field.key] = values[`check_${field.key}`] ?? ''; continue; }
      const outcome = values[`check_${field.key}`];
      const reason = String(values[`reason_${field.key}`] ?? '').trim();
      if (outcome === 'fail' && !reason) { setMessage(`Enter a reason for the failed check: ${field.label}`); return; }
      checklistData[field.key] = outcome === 'fail' ? { outcome, reason } : { outcome };
    }
    const payload = { rickshaw_id: values.rickshaw_id, template_id: values.template_id, checklist_data: activeFields.length > 0 ? checklistData : { notes: values.notes ?? '' }, result: values.result, client_timestamp: new Date().toISOString() };
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
  async function lookupShortCode() {
    const code = shortCode.trim();
    if (!code) { setLiveVerification({ valid: false, reason: 'Enter a certificate short code.' }); return; }
    if (!navigator.onLine) { setLiveVerification({ valid: false, reason: 'Internet connection required for live status lookup.' }); return; }
    setLiveVerificationLoading(true);
    try {
      const response = await fetch(`${API}/api/v1/public/verify/${encodeURIComponent(code)}`);
      const body = await response.json() as { data?: LiveVerification };
      setLiveVerification(body.data ?? { valid: false, reason: 'Unexpected verification response.' });
    } catch (error) {
      setLiveVerification({ valid: false, reason: error instanceof Error ? error.message : 'network error' });
    } finally { setLiveVerificationLoading(false); }
  }
  async function provisionUser(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch(`${API}/api/v1/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ external_subject: values.external_subject, display_name: values.display_name, roles: [values.role], scopes: values.district_id && values.zone_id ? [{ district_id: values.district_id, zone_id: values.zone_id }] : [] }) });
    setMessage(response.ok ? 'User provisioned successfully.' : `Provisioning failed: ${await response.text()}`);
  }
  async function searchVehicle() {
    const chassis = vehicleSearch.trim();
    if (!chassis) { setVehicleResult(null); setMessage('Enter a chassis number to search.'); return; }
    if (!token || !navigator.onLine) { setMessage('Connect to the internet and sign in before searching the vehicle registry.'); return; }
    setVehicleLookupLoading(true);
    try {
      const response = await fetch(`${API}/api/v1/rickshaws?chassis_number=${encodeURIComponent(chassis)}`, { headers: auth });
      if (!response.ok) { setVehicleResult(null); setMessage(`Vehicle search failed: ${await response.text()}`); return; }
      const body = await response.json() as { data: Rickshaw | null };
      setVehicleResult(body.data);
      setMessage(body.data ? 'Vehicle found. You can use its UUID in the inspection form.' : 'No vehicle found with that chassis number.');
    } catch (error) { setVehicleResult(null); setMessage(`Vehicle search failed: ${error instanceof Error ? error.message : 'network error'}`); }
    finally { setVehicleLookupLoading(false); }
  }
  async function registerVehicle(form: HTMLFormElement) {
    if (!token || !navigator.onLine) { setMessage('Vehicle registration requires an authenticated online connection.'); return; }
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`${API}/api/v1/rickshaws`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ chassis_number: values.chassis_number, motor_number: values.motor_number || undefined, owner_phone: values.owner_phone, district_id: values.district_id, zone_id: values.zone_id }) });
      if (!response.ok) { setMessage(`Vehicle registration failed: ${await response.text()}`); return; }
      const body = await response.json() as { data: Rickshaw };
      setVehicleResult(body.data); setVehicleSearch(String(values.chassis_number));
      setMessage(`Vehicle registered (${body.data.id}). Use this UUID for the inspection.`);
      form.reset();
    } catch (error) { setMessage(`Vehicle registration failed: ${error instanceof Error ? error.message : 'network error'}`); }
  }
  return <main>
    <header><h1>E-Rickshaw Fitness</h1><p>Inspector & roadside verification PWA</p></header>
    <nav><button onClick={() => setView('inspection')}>Inspection</button><button onClick={() => setView('verification')}>Verify QR</button><button onClick={() => setView('admin')}>Admin</button></nav>
    <section className="notice">{message} Offline queue: {pending}</section>
    {oidcConfig ? (
      <section className="auth-panel">
        {token
          ? <p className="result valid">Signed in. <button type="button" onClick={() => { setToken(''); setMessage('Signed out.'); }}>Sign out</button></p>
          : <button type="button" onClick={() => void beginSignIn(oidcConfig)} disabled={signingIn}>{signingIn ? 'Completing sign-in…' : 'Sign in with authority identity'}</button>}
      </section>
    ) : (
      <label>Access token (development only)<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Bearer token" /></label>
    )}
    {view === 'inspection' ? <section><section className="verification-panel"><h2>Vehicle registry</h2><p className="muted">Search an existing vehicle by chassis number or register one in your assigned district and zone.</p><div className="inline-form"><label>Chassis number<input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="e.g. ER-8821" /></label><button type="button" onClick={() => void searchVehicle()} disabled={vehicleLookupLoading}>{vehicleLookupLoading ? 'Searching…' : 'Search vehicle'}</button></div>{vehicleResult ? <p className="result valid">Found: <strong>{vehicleResult.chassis_number}</strong> · UUID <code>{vehicleResult.id}</code> · Motor {vehicleResult.motor_number ?? '—'} · Status {vehicleResult.status}</p> : null}<details><summary>Register new vehicle</summary><form onSubmit={(event) => { event.preventDefault(); void registerVehicle(event.currentTarget); }}><label>Chassis number<input name="chassis_number" required /></label><label>Motor number<input name="motor_number" /></label><label>Owner phone<input name="owner_phone" required placeholder="01XXXXXXXXX" /></label><label>District UUID<input name="district_id" required /></label><label>Zone UUID<input name="zone_id" required /></label><button type="submit">Register vehicle</button></form></details></section><h2>Submit fitness inspection</h2><form onSubmit={(event) => { event.preventDefault(); void submitInspection(event.currentTarget); }}>
      <label>Rickshaw UUID<input name="rickshaw_id" required /></label>{templates.length > 0 ? <label>Checklist template<select name="template_id" required value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>{templates.map((template) => <option value={template.id} key={template.id}>{template.version} — {template.vehicle_type}</option>)}</select>{templatesLoading ? <small>Refreshing templates…</small> : <small>{navigator.onLine && token ? 'Live templates' : 'Cached templates (offline)'}</small>}</label> : <label>Checklist template UUID<input name="template_id" required placeholder="Template UUID (sync requires a published template)" /><small>No cached templates available. Connect and sign in to load the current checklist.</small></label>}
      {activeFields.length > 0 ? activeFields.map((field) => field.type === 'text'
        ? <label key={field.key}>{field.label}{field.label_bn ? <span className="muted"> ({field.label_bn})</span> : null}<textarea name={`check_${field.key}`} /></label>
        : <div className="checklist-field" key={field.key}>
            <label>{field.label}{field.label_bn ? <span className="muted"> ({field.label_bn})</span> : null}<select name={`check_${field.key}`} defaultValue="pass"><option value="pass">Pass</option><option value="fail">Fail</option><option value="na">N/A</option></select></label>
            <label>Reason if failed<input name={`reason_${field.key}`} placeholder="Required only if this check failed" /></label>
          </div>) : <label>Notes<textarea name="notes" /></label>}
      <label>Result<select name="result"><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <button type="submit">Submit / save offline</button><button type="button" onClick={() => void syncDrafts()}>Sync saved inspections</button>
    </form></section> : view === 'verification' ? <section><h2>Certificate verification</h2><p className="muted">Offline signature verification works without internet. Live lookup checks the current certificate status and revocation state.</p><div className="verification-panel"><h3>Offline QR signature</h3><label>QR payload<textarea value={certificate} onChange={(event) => setCertificate(event.target.value)} placeholder="ERF1...." /></label><button onClick={() => void verifyCertificate()}>Verify signature offline</button><p className="result">{verification || 'No offline verification performed yet.'}</p></div><div className="verification-panel"><h3>Live certificate status</h3><label>Certificate short code<input value={shortCode} onChange={(event) => setShortCode(event.target.value)} placeholder="e.g. X9K2L" /></label><button onClick={() => void lookupShortCode()} disabled={liveVerificationLoading}>{liveVerificationLoading ? 'Checking…' : 'Check live status'}</button>{liveVerification ? <p className={`result ${liveVerification.valid ? 'valid' : 'invalid'}`}>{liveVerification.valid ? `Active certificate ${liveVerification.certificate_number ?? ''}. Zone: ${liveVerification.zone ?? '—'}. Chassis: ••••${liveVerification.chassis_suffix ?? '—'}. Expires: ${liveVerification.expires_at ? new Date(liveVerification.expires_at).toLocaleDateString() : '—'}.` : `Live status: ${liveVerification.status ?? 'not valid'}. ${liveVerification.reason ?? 'Certificate is inactive, expired, or not found.'}`}</p> : <p className="muted">No live lookup performed yet.</p>}</div></section> : <>
      <section><h2>Provision OIDC user</h2><p>Central administrator access is required.</p><form onSubmit={(event) => { event.preventDefault(); void provisionUser(event.currentTarget); }}><label>External identity subject<input name="external_subject" required placeholder="identity-provider subject" /></label><label>Display name<input name="display_name" required /></label><label>Role<select name="role"><option value="inspector">Inspector</option><option value="hub_supervisor">Hub supervisor</option><option value="district_administrator">District administrator</option><option value="finance_operator">Finance operator</option><option value="traffic_police_verifier">Traffic police verifier</option></select></label><label>District UUID<input name="district_id" /></label><label>Zone UUID<input name="zone_id" /></label><button type="submit">Provision user</button></form></section>
      <section><div className="section-heading"><div><h2>Operations summary</h2><p className="muted">Counts are limited to your assigned district scope.</p></div><button type="button" onClick={() => void loadSummary()} disabled={summaryLoading}>{summaryLoading ? 'Refreshing…' : 'Refresh summary'}</button></div>{summary ? <div className="summary-grid">{([['rickshaws', 'Registered rickshaws'], ['inspections', 'Inspections'], ['paid_bills', 'Paid bills'], ['active_certificates', 'Active certificates'], ['queued_notifications', 'Queued notifications']] as Array<[keyof Summary, string]>).map(([key, label]) => <div className="summary-card" key={key}><span>{label}</span><strong>{summary[key].toLocaleString()}</strong></div>)}</div> : <p className="muted">Enter an access token with an administrative or finance role to load the summary.</p>}</section>
      <section><div className="section-heading"><div><h2>Reconciliation exceptions</h2><p className="muted">Failed and reversed payments, and bills otherwise flagged for review. Requires a finance or central administrator role.</p></div><button type="button" onClick={() => void loadReconciliation()} disabled={reconciliationLoading}>{reconciliationLoading ? 'Refreshing…' : 'Refresh exceptions'}</button></div>{reconciliation ? (reconciliation.length > 0 ? <table className="reconciliation-table"><thead><tr><th>Bill</th><th>Bill status</th><th>Amount</th><th>Provider</th><th>Payment status</th><th>Payment amount</th><th>When</th></tr></thead><tbody>{reconciliation.map((row) => <tr key={`${row.bill_code}-${row.provider_transaction_id ?? 'none'}`}><td>{row.bill_code}</td><td>{row.bill_status}</td><td>{(row.bill_amount_paisa / 100).toFixed(2)} BDT</td><td>{row.provider ?? '—'}</td><td>{row.payment_status ?? '—'}</td><td>{row.payment_amount_paisa !== null ? `${(row.payment_amount_paisa / 100).toFixed(2)} BDT` : '—'}</td><td>{row.payment_at ? new Date(row.payment_at).toLocaleString() : '—'}</td></tr>)}</tbody></table> : <p className="muted">No reconciliation exceptions outstanding.</p>) : <p className="muted">Enter an access token with a finance or central administrator role to load exceptions.</p>}</section>
    </>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
