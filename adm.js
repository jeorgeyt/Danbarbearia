// =========================================================
// DanBarbeiro ADMIN - scripts do painel administrativo
// Arquivo separado para gestão de login, dados e exportações.
// =========================================================

const DEFAULT_SERVICES = [
  { id: 1, name: 'Corte Clássico', desc: 'Tesoura, máquina ou degradê', price: 35 },
  { id: 2, name: 'Corte + Barba', desc: 'Combo completo', price: 55 },
  { id: 3, name: 'Degradê', desc: 'Fade suave ou americano', price: 40 },
  { id: 4, name: 'Barba', desc: 'Modelagem e acabamento', price: 25 },
  { id: 5, name: 'Pacote VIP', desc: 'Corte + barba + sobrancelha + hidratação', price: 80 },
  { id: 6, name: 'Sobrancelha', desc: 'Desenho e modelagem', price: 15 }
];
const WEEKDAYS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

let services = load('db_services', DEFAULT_SERVICES);
let promos = load('db_promos', []);
let appointments = load('db_appointments', []);
let dailyLimit = load('db_limit', 8);
let weekdayLimits = load('db_weekday_limits', { 0:8,1:8,2:8,3:8,4:8,5:6 });
let emailConfig = load('db_email_config', { dest:'', subject:'Novo agendamento — DanBarbeiro', perBooking:true, daily:false });
let waConfig = load('db_wa_config', { num:'5588900000000', msg:'Olá! Sou {nome} e gostaria de agendar: {servico}.' });

function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  const creds = load('db_creds', { user: 'admin', pass: 'dan2024' });
  if (u === creds.user && p === creds.pass) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    initAdmin();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}
function doLogout() {
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
  if (id === 'dashboard') renderDashboard();
  if (id === 'agendamentos') renderTable();
  if (id === 'servicos') renderServices();
  if (id === 'promocoes') renderPromos();
  if (id === 'limite') renderLimit();
  if (id === 'email') renderEmailPage();
}

function showNotif(msg) {
  const n = document.getElementById('notif');
  n.textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2800);
}

function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === today);
  const weekAppts = appointments.filter(a => {
    const d = new Date(a.date); const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    return d >= startOfWeek;
  });
  const lim = dailyLimit;
  document.getElementById('metric-hoje').textContent = todayAppts.length;
  document.getElementById('metric-limite-sub').textContent = `Limite: ${lim} vagas`;
  document.getElementById('metric-vagas').textContent = Math.max(0, lim - todayAppts.length);
  document.getElementById('metric-semana').textContent = weekAppts.length;
  document.getElementById('metric-promos').textContent = promos.filter(p => p.active).length;
  const tbody = document.getElementById('recent-tbody');
  const last5 = [...appointments].reverse().slice(0, 5);
  if (last5.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:2rem;">Nenhum agendamento ainda.</td></tr>';
  } else {
    tbody.innerHTML = last5.map(a => `
      <tr>
        <td>${a.name}</td>
        <td>${a.service}</td>
        <td>${formatDate(a.date)}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
      </tr>`).join('');
  }
}

function renderTable() {
  const dateFilter = document.getElementById('filter-date')?.value;
  const statusFilter = document.getElementById('filter-status')?.value;
  let data = [...appointments];
  if (dateFilter) data = data.filter(a => a.date === dateFilter);
  if (statusFilter) data = data.filter(a => a.status === statusFilter);
  const tbody = document.getElementById('main-tbody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:2rem;">Nenhum agendamento encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((a, i) => `
    <tr>
      <td>${a.name}</td>
      <td><a href="https://wa.me/${a.phone.replace(/\D/g,'')}" target="_blank" style="color:var(--accent);text-decoration:none;">${a.phone}</a></td>
      <td>${a.service}</td>
      <td>${formatDate(a.date)}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm btn-outline-sm" style="padding:4px 10px;font-size:0.68rem;" onclick="setStatus(${a.id},'confirmado')" title="Confirmar">✓</button>
          <button class="btn-sm btn-danger-sm" style="padding:4px 10px;font-size:0.68rem;" onclick="setStatus(${a.id},'cancelado')" title="Cancelar">✕</button>
          <button class="btn-sm btn-danger-sm" style="padding:4px 10px;font-size:0.68rem;background:rgba(231,76,60,0.7);" onclick="deleteAppointment(${a.id})" title="Excluir permanentemente">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}
function setStatus(id, status) {
  appointments = appointments.map(a => a.id === id ? {...a, status} : a);
  save('db_appointments', appointments);
  renderTable();
  showNotif('Status atualizado!');
}
function deleteAppointment(id) {
  if (!confirm('Tem certeza que deseja excluir este agendamento permanentemente?')) return;
  appointments = appointments.filter(a => a.id !== id);
  save('db_appointments', appointments);
  renderTable();
  renderDashboard();
  showNotif('Agendamento excluído!');
}
function formatDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function renderServices() {
  document.getElementById('services-list').innerHTML = services.map(s => `
    <div class="service-item">
      <div>
        <div class="service-item-name">${s.name}</div>
        <div class="service-item-desc">${s.desc}</div>
      </div>
      <span style="font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted);">R$</span>
      <input class="price-input" type="number" value="${s.price}" min="0" data-id="${s.id}" step="0.5">
      <span style="font-size:0.72rem;color:var(--muted);">/sessão</span>
    </div>`).join('');
}
function saveServices() {
  document.querySelectorAll('.price-input').forEach(inp => {
    const id = parseInt(inp.dataset.id);
    services = services.map(s => s.id === id ? {...s, price: parseFloat(inp.value) || s.price} : s);
  });
  save('db_services', services);
  showNotif('Preços salvos com sucesso!');
}
function resetServices() {
  services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
  save('db_services', services);
  renderServices();
  showNotif('Preços restaurados!');
}
function exportServicosJSON() {
  const blob = new Blob([JSON.stringify(services, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'danbarbeiro_servicos.json'; a.click();
}

function renderPromos() {
  const list = document.getElementById('promo-list');
  const empty = document.getElementById('promo-empty');
  if (promos.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = promos.map((p, i) => `
    <div class="promo-card ${p.active ? '' : 'inactive'}">
      <div>
        <div class="promo-tag-badge">${p.service || 'Todos os serviços'}</div>
        <div class="promo-name">${p.name}</div>
        <div class="promo-desc">${p.desc}</div>
        ${p.expiry ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:6px;">Válido até ${formatDate(p.expiry)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="promo-discount">${p.discount}</div>
        <div style="display:flex;gap:8px;margin-top:1rem;justify-content:flex-end;">
          <button class="btn-sm btn-outline-sm" style="padding:6px 12px;font-size:0.7rem;" onclick="togglePromo(${i})">${p.active ? 'Pausar' : 'Ativar'}</button>
          <button class="btn-sm btn-danger-sm" style="padding:6px 12px;font-size:0.7rem;" onclick="deletePromo(${i})">Excluir</button>
        </div>
      </div>
    </div>`).join('');
}
function addPromo() {
  const nome = document.getElementById('promo-nome').value.trim();
  const desconto = document.getElementById('promo-desconto').value.trim();
  const desc = document.getElementById('promo-desc').value.trim();
  const validade = document.getElementById('promo-validade').value;
  const servico = document.getElementById('promo-servico').value;
  if (!nome || !desconto) { showNotif('Preencha nome e desconto!'); return; }
  promos.push({ name: nome, discount: desconto, desc, expiry: validade, service: servico, active: true });
  save('db_promos', promos);
  ['promo-nome','promo-desconto','promo-desc','promo-validade'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('promo-servico').value = '';
  renderPromos();
  showNotif('Promoção adicionada!');
}
function togglePromo(i) { promos[i].active = !promos[i].active; save('db_promos', promos); renderPromos(); }
function deletePromo(i) { promos.splice(i, 1); save('db_promos', promos); renderPromos(); showNotif('Promoção removida.'); }

function renderLimit() {
  document.getElementById('limit-display').textContent = dailyLimit;
  document.getElementById('limit-input').value = dailyLimit;
  updateLimitUI();
  const wd = document.getElementById('weekday-limits');
  wd.innerHTML = WEEKDAYS.map((d, i) => `
    <div class="toggle-row">
      <div class="toggle-label">${d}</div>
      <input type="number" min="0" max="50" value="${weekdayLimits[i] ?? dailyLimit}" data-day="${i}"
        style="width:70px;background:var(--dark);border:1px solid var(--border);color:var(--accent);padding:6px 8px;font-family:var(--font-head);font-size:1.1rem;text-align:center;outline:none;">
    </div>`).join('');
}
function changeLimit(delta) {
  dailyLimit = Math.max(1, Math.min(50, dailyLimit + delta));
  document.getElementById('limit-display').textContent = dailyLimit;
  document.getElementById('limit-input').value = dailyLimit;
  updateLimitUI();
}
function syncLimit(v) {
  dailyLimit = Math.max(1, Math.min(50, parseInt(v) || 1));
  document.getElementById('limit-display').textContent = dailyLimit;
  updateLimitUI();
}
function updateLimitUI() {
  const today = new Date().toISOString().split('T')[0];
  const used = appointments.filter(a => a.date === today).length;
  const remaining = Math.max(0, dailyLimit - used);
  const pct = dailyLimit > 0 ? Math.min(100, (used / dailyLimit) * 100) : 0;
  document.getElementById('limit-remaining').textContent = `${remaining} vagas livres`;
  document.getElementById('progress-fill').style.width = pct + '%';
}
function saveLimit() {
  save('db_limit', dailyLimit);
  showNotif(`Limite salvo: ${dailyLimit} clientes/dia`);
}
function saveWeekdayLimits() {
  document.querySelectorAll('#weekday-limits input[data-day]').forEach(inp => {
    weekdayLimits[parseInt(inp.dataset.day)] = parseInt(inp.value) || dailyLimit;
  });
  save('db_weekday_limits', weekdayLimits);
  showNotif('Limites por dia salvos!');
}

function renderEmailPage() {
  document.getElementById('email-dest').value = emailConfig.dest || '';
  document.getElementById('email-subject').value = emailConfig.subject;
  document.getElementById('toggle-email').checked = emailConfig.perBooking;
  document.getElementById('toggle-resumo').checked = emailConfig.daily;
  document.getElementById('whatsapp-num').value = waConfig.num;
  document.getElementById('whatsapp-msg').value = waConfig.msg;
  updateEmailPreview();
  document.getElementById('email-dest').addEventListener('input', updateEmailPreview);
  document.getElementById('email-subject').addEventListener('input', updateEmailPreview);
}
function updateEmailPreview() {
  const dest = document.getElementById('email-dest').value || '(configure seu e-mail acima)';
  const subject = document.getElementById('email-subject').value;
  document.getElementById('email-preview').innerHTML = `
    <strong>Para:</strong> ${dest}<br>
    <strong>Assunto:</strong> ${subject}<br><br>
    <strong>Nome:</strong> João Silva<br>
    <strong>WhatsApp:</strong> (88) 9 9999-0000<br>
    <strong>Serviço:</strong> Corte + Barba — R$ 55<br>
    <strong>Data:</strong> 28/04/2025<br>
    <strong>Hora do agendamento:</strong> 14:32`;
}
function saveEmailConfig() {
  emailConfig = {
    dest: document.getElementById('email-dest').value,
    subject: document.getElementById('email-subject').value,
    perBooking: document.getElementById('toggle-email').checked,
    daily: document.getElementById('toggle-resumo').checked
  };
  save('db_email_config', emailConfig);
  showNotif('Configurações de e-mail salvas!');
}
function saveWhatsApp() {
  waConfig = { num: document.getElementById('whatsapp-num').value, msg: document.getElementById('whatsapp-msg').value };
  save('db_wa_config', waConfig);
  showNotif('WhatsApp salvo!');
}

function exportCSV() {
  const header = 'Nome,WhatsApp,Serviço,Data,Status';
  const rows = appointments.map(a => `"${a.name}","${a.phone}","${a.service}","${formatDate(a.date)}","${a.status}"`);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'agendamentos_danbarbeiro.csv'; a.click();
  showNotif('CSV exportado!');
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(appointments, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'agendamentos_danbarbeiro.json'; a.click();
}
function printAgendamentos() {
  const today = new Date().toISOString().split('T')[0];
  const data = appointments.filter(a => a.date === today);
  const win = window.open('','_blank');
  win.document.write(`<html><head><title>Agenda do dia</title></head><body style="font-family:sans-serif;padding:2rem;">
    <h2>DanBarbeiro — Agenda ${formatDate(today)}</h2>
    <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;">
      <tr><th>#</th><th>Nome</th><th>WhatsApp</th><th>Serviço</th><th>Status</th></tr>
      ${data.map((a,i) => `<tr><td>${i+1}</td><td>${a.name}</td><td>${a.phone}</td><td>${a.service}</td><td>${a.status}</td></tr>`).join('')}
    </table>
    <p style="margin-top:1rem;color:#888;font-size:0.85rem;">Total: ${data.length} agendamentos</p>
  </body></html>`);
  win.print();
}

function initAdmin() {
  renderDashboard();
}
