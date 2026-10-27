(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const MAX = 5 * 1024 * 1024, TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const LABELS = { approvalNo: 'AICTE Approval No.', instituteId: 'Permanent Institute ID', institution: 'Institution (body)', headerInstitution: 'Institution (letterhead)', programme: 'Programme', intake: 'Approved Intake', academicYear: 'Academic Year', issueDate: 'Issue Date', validUpto: 'Valid Upto' };
const REQUIRED = Object.keys(LABELS);
// Fictional demo registry used for the duplicate-identifier check
const REGISTRY = ['1-9100000002', '1-9100000003'];
const SCENARIOS = [
 { id: 'valid', title: 'Approval Letter — consistent', desc: 'Complete fields, valid dates', f: { approvalNo: 'F.No. Western/1-9100000001/2026/EOA', instituteId: '1-9100000001', institution: 'Sample Institute of Technology (Mock)', headerInstitution: 'Sample Institute of Technology (Mock)', programme: 'B.E. Computer Engineering', intake: '120', academicYear: '2026-27', issueDate: '2026-04-15', validUpto: '2027-03-31' } },
 { id: 'expired', title: 'Approval Letter — expired, incomplete', desc: 'Expired validity and missing intake', f: { approvalNo: 'F.No. Western/1-9100000004/2024/EOA', instituteId: '1-9100000004', institution: 'Demo College of Engineering (Mock)', headerInstitution: 'Demo College of Engineering (Mock)', programme: 'Diploma in Mechanical Engineering', intake: '', academicYear: '2024-25', issueDate: '2024-04-10', validUpto: '2025-03-31' } },
 { id: 'mismatch', title: 'Approval Letter — inconsistent', desc: 'Name mismatch, duplicate ID, odd date format', f: { approvalNo: 'F.No. Southern/1-9100000002/2026/EOA', instituteId: '1-9100000002', institution: 'Example Polytechnic (Mock)', headerInstitution: 'Exmaple Polytechnik (Mock)', programme: 'MBA', intake: '60', academicYear: '2026-27', issueDate: '15/04/2026', validUpto: '2027-03-31' } }
];
const state = { scenario: SCENARIOS[0], file: null, url: null, result: null, decision: '', running: false };

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function setMsg(node, text, kind) { node.textContent = text; node.className = 'msg' + (kind ? ' ' + kind : ''); }
function setStep(n) { $$('#tracker li').forEach(li => { const s = +li.dataset.s; li.classList.toggle('done', s < n); li.classList.toggle('active', s === n); }); }
function fmtSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB'; }
function parseDate(v) {
 let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v), iso = true;
 if (!m) { m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); iso = false; if (m) m = [m[0], m[3], m[2], m[1]]; }
 if (!m) return null;
 const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
 return d.getUTCMonth() === +m[2] - 1 ? { d, iso } : null;
}

// ---- Validation rules (real logic, run over deterministic demo fields)
function validate(f) {
 const checks = [], add = (status, label, msg, field) => checks.push({ status, label, msg, field });
 REQUIRED.forEach(k => f[k] && f[k].trim() ? add('pass', 'Required: ' + LABELS[k], 'Value present.', k) : add('fail', 'Required: ' + LABELS[k], 'Value is missing. Obtain it from the source document.', k));
 if (f.approvalNo) /^F\.No\.\s[A-Za-z]+\/1-\d{10}\/\d{4}\/EOA$/.test(f.approvalNo) ? add('pass', 'Approval number format', 'Matches the expected pattern.', 'approvalNo') : add('fail', 'Approval number format', 'Does not match the expected pattern.', 'approvalNo');
 if (f.approvalNo && f.instituteId) f.approvalNo.includes(f.instituteId) ? add('pass', 'Approval No. contains Institute ID', 'IDs agree.', 'instituteId') : add('warn', 'Approval No. contains Institute ID', 'IDs differ. Re-check both.', 'instituteId');
 if (f.instituteId) REGISTRY.includes(f.instituteId) ? add('warn', 'Duplicate identifier (demo dataset)', 'ID already appears in the demo registry. Confirm it is not a repeat submission.', 'instituteId') : add('pass', 'Duplicate identifier (demo dataset)', 'No duplicate found in the demo registry.', 'instituteId');
 if (f.institution && f.headerInstitution) f.institution === f.headerInstitution ? add('pass', 'Institution name consistency', 'Letterhead and body agree.', 'headerInstitution') : add('warn', 'Institution name consistency', 'Letterhead and body names differ. This could be a typo or an altered document.', 'headerInstitution');
 if (f.intake) /^[1-9]\d*$/.test(f.intake) ? add('pass', 'Intake is a positive number', 'Valid.', 'intake') : add('fail', 'Intake is a positive number', 'Not a valid number.', 'intake');
 if (f.academicYear) { const m = /^(\d{4})-(\d{2})$/.exec(f.academicYear); m && (+m[1] + 1) % 100 === +m[2] ? add('pass', 'Academic year format', 'Valid.', 'academicYear') : add('fail', 'Academic year format', 'Expected YYYY-YY with consecutive years.', 'academicYear'); }
 const iss = f.issueDate && parseDate(f.issueDate), exp = f.validUpto && parseDate(f.validUpto);
 [['issueDate', iss], ['validUpto', exp]].forEach(([k, p]) => { if (!f[k]) return; if (!p) add('fail', LABELS[k] + ' format', 'Not a valid date.', k); else if (!p.iso) add('warn', LABELS[k] + ' format', 'Uses DD/MM/YYYY while the expected format is YYYY-MM-DD. Check for formatting irregularities.', k); else add('pass', LABELS[k] + ' format', 'Valid date.', k); });
 if (iss && exp) { exp.d > iss.d ? add('pass', 'Validity after issue date', 'Dates are in order.', 'validUpto') : add('fail', 'Validity after issue date', 'Valid-upto date is not after the issue date.', 'validUpto');
  exp.d >= new Date() ? add('pass', 'Approval not expired', 'Validity period has not ended.', 'validUpto') : add('fail', 'Approval not expired', 'Validity ended on ' + f.validUpto + '.', 'validUpto'); }
 return checks;
}
function summarize(checks) {
 const n = s => checks.filter(c => c.status === s).length, fail = n('fail'), warn = n('warn');
 return { checks, total: checks.length, pass: n('pass'), warn, fail, overall: fail ? 'Failed Checks' : warn ? 'Needs Review' : 'Passed', at: new Date() };
}
function actionsFor(r) {
 const a = [];
 if (r.fail) a.push('Resolve failed checks by obtaining correct or missing values from the issuing source.');
 if (r.warn) a.push('Manually inspect flagged warnings against the original document.');
 a.push('Confirm the approval number and institution on the official AICTE portal. This demo cannot do that.');
 if (!r.fail && !r.warn) a.push('Format checks passed. Identity, source and legal authenticity are still unverified.');
 return a;
}

// ---- Rendering
function renderScenarios() {
 const box = $('#scen');
 SCENARIOS.forEach(s => { const b = el('button'); b.type = 'button'; b.setAttribute('aria-pressed', s.id === state.scenario.id);
  b.append(el('b', '', s.title), el('small', '', s.desc)); b.addEventListener('click', () => { state.scenario = s; clearResults(); renderScenarios.sync(); }); box.append(b); });
 renderScenarios.sync = () => { [...box.children].forEach((b, i) => b.setAttribute('aria-pressed', SCENARIOS[i].id === state.scenario.id)); renderSample(); };
 renderSample();
}
function renderSample() {
 const box = $('#sample'); box.replaceChildren(el('b', '', 'Sample document data (fictional)'));
 const dl = el('dl'); Object.entries(state.scenario.f).forEach(([k, v]) => dl.append(el('dt', '', LABELS[k]), el('dd', '', v || '(blank)'))); box.append(dl);
}
function renderResults() {
 const r = state.result; $('#empty').hidden = true; $('#out').hidden = false;
 const ov = $('#overall'); ov.textContent = r.overall; ov.className = 'badge ' + (r.fail ? 'r' : r.warn ? 'a' : 'g');
 $('#stamp').textContent = 'Verified (demo) ' + r.at.toLocaleString();
 $('#cTotal').textContent = r.total; $('#cPass').textContent = r.pass; $('#cWarn').textContent = r.warn; $('#cFail').textContent = r.fail;
 const fb = $('#fields'); fb.replaceChildren();
 Object.keys(LABELS).forEach(k => { const cs = r.checks.filter(c => c.field === k), st = cs.some(c => c.status === 'fail') ? 'fail' : cs.some(c => c.status === 'warn') ? 'warn' : 'pass';
  const tr = el('tr'), td = el('td'); td.append(el('span', 'pill ' + st, st === 'pass' ? 'Passed' : st === 'warn' ? 'Warning' : 'Failed'));
  tr.append(el('td', '', LABELS[k]), el('td', '', state.scenario.f[k] || '(missing)'), td); fb.append(tr); });
 const ul = $('#checks'); ul.replaceChildren();
 [...r.checks].sort((a, b) => ['fail', 'warn', 'pass'].indexOf(a.status) - ['fail', 'warn', 'pass'].indexOf(b.status)).forEach(c => { const li = el('li', c.status); li.append(el('b', '', c.label + ': '), document.createTextNode(c.msg)); ul.append(li); });
 const ac = $('#actions'); ac.replaceChildren(); actionsFor(r).forEach(t => ac.append(el('li', '', t)));
 setMsg($('#decision'), state.decision ? 'Reviewer decision: ' + state.decision : 'No reviewer decision yet.', state.decision ? 'ok' : '');
}
function clearResults() { state.result = null; state.decision = ''; $('#out').hidden = true; $('#empty').hidden = false; setMsg($('#runMsg'), ''); setStep(state.file || true ? 1 : 1); }

// ---- File handling
function removeFile() { if (state.url) URL.revokeObjectURL(state.url); state.file = state.url = null; $('#fileInfo').hidden = true; $('#viewer').replaceChildren(); $('#file').value = ''; setMsg($('#fileMsg'), ''); clearResults(); }
function handleFile(file) {
 if (!file) return;
 if (!TYPES.includes(file.type)) return setMsg($('#fileMsg'), 'Unsupported file type. Upload a PDF, PNG or JPG file.', 'err');
 if (file.size > MAX) return setMsg($('#fileMsg'), 'File is ' + fmtSize(file.size) + '. The limit is 5 MB.', 'err');
 if (file.size === 0) return setMsg($('#fileMsg'), 'The file is empty. Choose another file.', 'err');
 removeFile(); state.file = file; state.url = URL.createObjectURL(file);
 $('#fname').textContent = file.name; $('#fsize').textContent = fmtSize(file.size); $('#fileInfo').hidden = false;
 const v = $('#viewer'); let node;
 if (file.type === 'application/pdf') { node = el('iframe'); node.title = 'PDF preview'; } else { node = el('img'); node.alt = 'Preview of ' + file.name; }
 node.src = state.url; v.replaceChildren(node);
 setMsg($('#fileMsg'), 'File accepted. It stays in your browser; its content is not analysed in Demo Mode.', 'ok');
}

// ---- Verification run (simulated, shown step by step in a popup)
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run() {
 if (state.running) return;
 state.running = true; state.cancel = false; clearResults(); $('#run').disabled = true;
 const modal = $('#modal'), title = $('#mTitle'), desc = $('#mDesc'), bar = $('#mBar'), log = $('#mLog');
 const wait = async ms => { await sleep(ms); if (state.cancel) throw new Error('cancel'); };
 const stage = (n, t, d, p) => { setStep(n); title.textContent = t; desc.textContent = d; bar.style.width = p + '%'; setMsg($('#runMsg'), 'Simulated processing: ' + t + '…'); };
 const note = (t, cls) => { log.append(el('li', cls || '', t)); log.scrollTop = log.scrollHeight; };
 log.replaceChildren(); bar.style.width = '0%'; modal.hidden = false; $('#mCancel').focus();
 try {
  const f = state.scenario.f, keys = Object.keys(LABELS);
  stage(1, 'Step 1 of 4 · Reading document', 'Checking file details. Simulated in Demo Mode.', 8);
  note(state.file ? 'File received: ' + state.file.name + ' (' + fmtSize(state.file.size) + ')' : 'Sample loaded: ' + state.scenario.title);
  await wait(1200); note('Type and size checks passed.', 'pass'); await wait(1200);
  stage(2, 'Step 2 of 4 · Extracting information', 'Loading deterministic sample fields. No AI model is analysing your file.', 15);
  for (let i = 0; i < keys.length; i++) { note(LABELS[keys[i]] + ': ' + (f[keys[i]] || '(missing)'), f[keys[i]] ? '' : 'warn'); bar.style.width = 15 + (i + 1) / keys.length * 25 + '%'; await wait(550); }
  stage(3, 'Step 3 of 4 · Running validation checks', 'Applying rule-based checks to the extracted fields.', 40);
  await wait(900);
  const checks = validate(f);
  for (let i = 0; i < checks.length; i++) { const c = checks[i]; note((c.status === 'pass' ? '✓ ' : c.status === 'warn' ? '⚠ ' : '✕ ') + c.label, c.status); bar.style.width = 40 + (i + 1) / checks.length * 50 + '%'; await wait(c.status === 'pass' ? 450 : 900); }
  stage(4, 'Step 4 of 4 · Preparing results', 'Compiling summary, field status and next actions.', 95);
  await wait(1500); bar.style.width = '100%'; note('Analysis complete. Opening results.', 'pass'); await wait(900);
  state.result = summarize(checks); modal.hidden = true; renderResults(); setStep(4);
  setMsg($('#runMsg'), 'Demo verification complete. Used ' + (state.file ? 'scenario data (uploaded file was not analysed).' : 'the selected sample document.'), 'ok');
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
 } catch (e) {
  setStep(1); setMsg($('#runMsg'), e.message === 'cancel' ? 'Verification cancelled. No results were produced.' : 'Something went wrong while validating. Reset and try again.', 'err');
 } finally { modal.hidden = true; state.running = false; $('#run').disabled = false; $('#run').focus(); }
}

// ---- Report
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function downloadReport() {
 const r = state.result; if (!r) return;
 const rows = k => r.checks.filter(c => c.status === k).map(c => `<li>${esc(c.label)} — ${esc(c.msg)}</li>`).join('') || '<li>None</li>';
 const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>PRAMA-AI Verification Report</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:30px auto;padding:0 16px;color:#0B1220}table{border-collapse:collapse;width:100%}td,th{border:1px solid #CBD5E1;padding:6px;text-align:left}.d{background:#FEF3C7;border:1px solid #F59E0B;padding:10px}</style></head><body>
<h1>PRAMA-AI — Verification Report</h1><p class="d"><b>Demo Mode:</b> Results are illustrative and do not constitute official document authentication.</p>
<p><b>File:</b> ${esc(state.file ? state.file.name : 'Sample: ' + state.scenario.title)}<br><b>Scenario:</b> ${esc(state.scenario.title)}<br><b>Date/time:</b> ${esc(r.at.toLocaleString())}<br><b>Overall:</b> ${esc(r.overall)}<br><b>Reviewer decision:</b> ${esc(state.decision || 'Not provided')}</p>
<h2>Summary</h2><p>Total ${r.total} · Passed ${r.pass} · Warnings ${r.warn} · Failed ${r.fail}</p>
<h2>Extracted fields (demo data)</h2><table>${Object.keys(LABELS).map(k => `<tr><th>${esc(LABELS[k])}</th><td>${esc(state.scenario.f[k] || '(missing)')}</td></tr>`).join('')}</table>
<h2>Failed checks</h2><ul>${rows('fail')}</ul><h2>Warnings</h2><ul>${rows('warn')}</ul><h2>Passed checks</h2><ul>${rows('pass')}</ul>
<h2>Recommended next actions</h2><ul>${actionsFor(r).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
<p><small>This report reflects format validation only. It is not identity verification, source verification or legal authenticity.</small></p></body></html>`;
 const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), a = el('a');
 a.href = url; a.download = 'prama-ai-report-' + Date.now() + '.html'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Wiring
function init() {
 $('#year').textContent = new Date().getFullYear();
 const burger = $('#burger'), menu = $('#menu');
 const toggle = open => { menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
 burger.addEventListener('click', () => toggle(!menu.classList.contains('open')));
 menu.addEventListener('click', e => { if (e.target.tagName === 'A') toggle(false); });
 document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle(false); state.cancel = true; } if (e.key === 'Tab' && !$('#modal').hidden) e.preventDefault(); });
 $('#mCancel').addEventListener('click', () => { state.cancel = true; });
 const drop = $('#drop'), input = $('#file');
 drop.addEventListener('click', () => input.click());
 drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
 input.addEventListener('change', () => handleFile(input.files[0]));
 ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
 ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
 drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
 $('#rmFile').addEventListener('click', removeFile);
 $('#run').addEventListener('click', run);
 $('#reset').addEventListener('click', () => { removeFile(); state.scenario = SCENARIOS[0]; renderScenarios.sync(); setMsg($('#runMsg'), 'Workspace reset.'); });
 $$('[data-d]').forEach(b => b.addEventListener('click', () => { if (!state.result) return; state.decision = b.dataset.d; setMsg($('#decision'), 'Reviewer decision: ' + state.decision, 'ok'); }));
 $('#download').addEventListener('click', downloadReport);
 renderScenarios();
}
init();
})();