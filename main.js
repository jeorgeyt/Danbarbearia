// =========================================================
// DanBarbeiro - scripts principais do site
// Arquivo separado para lógica de renderização, formulário e notificações.
// =========================================================

// ─── STORAGE HELPERS ──────────────────────────────────────────
function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ─── LOAD DATA ────────────────────────────────────────────────
let promos = load('db_promos', []);
let appointments = load('db_appointments', []);
let dailyLimit = load('db_limit', 8);
let waConfig = load('db_wa_config', { num:'5588900000000', msg:'Olá! Sou {nome} e gostaria de agendar: {servico}.' });
let emailConfig = load('db_email_config', { dest:'', subject:'Novo agendamento — DanBarbeiro', perBooking:true });

// ─── RENDER PROMOS ────────────────────────────────────────────
function renderPromos() {
  const activePromos = promos.filter(p => p.active);
  const section = document.getElementById('promocoes-section');
  const navPromo = document.getElementById('nav-promo');
  const grid = document.getElementById('promos-grid');

  if (activePromos.length === 0) {
    section.classList.remove('visible');
    navPromo.style.display = 'none';
    document.getElementById('promo-banner').classList.remove('visible');
    return;
  }

  section.classList.add('visible');
  navPromo.style.display = 'block';
  grid.innerHTML = activePromos.map(p => `
    <div class="promo-card-site">
      <div class="promo-card-tag">✦ ${p.service || 'Todos os serviços'}</div>
      <div class="promo-card-name">${p.name}</div>
      <div class="promo-card-desc">${p.desc}</div>
      <div class="promo-card-discount">${p.discount}</div>
      ${p.expiry ? `<div class="promo-card-expiry">Válido até ${formatDate(p.expiry)}</div>` : ''}
      <a href="#agendamento-wrap" class="btn btn-primary" style="margin-top:1.25rem;display:inline-block;padding:10px 24px;font-size:0.75rem;">Agendar agora</a>
    </div>`).join('');

  const first = activePromos[0];
  document.getElementById('promo-banner-tag').textContent = '✦ ' + first.name;
  document.getElementById('promo-banner-text').textContent = first.discount + ' — ' + (first.desc || '');
  document.getElementById('promo-banner').classList.add('visible');
}

function closeBanner() {
  document.getElementById('promo-banner').classList.remove('visible');
}

// ─── AGENDA STATUS ────────────────────────────────────────────
function checkAgendaStatus() {
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === today).length;
  const statusEl = document.getElementById('agenda-status');
  const dotEl = document.getElementById('status-dot');
  const textEl = document.getElementById('status-text');
  const remaining = Math.max(0, dailyLimit - todayAppts);

  if (todayAppts >= dailyLimit) {
    statusEl.className = 'agenda-status full';
    dotEl.className = 'status-dot full';
    textEl.textContent = 'Agenda cheia para hoje — escolha outra data';
  } else {
    statusEl.className = 'agenda-status available';
    dotEl.className = 'status-dot available';
    textEl.textContent = `Agenda aberta — ${remaining} vaga${remaining !== 1 ? 's' : ''} disponível${remaining !== 1 ? 'is' : ''} para hoje`;
  }
}

// ─── BOOKING ──────────────────────────────────────────────────
function handleBooking() {
  const name = document.getElementById('book-name').value.trim();
  const phone = document.getElementById('book-phone').value.trim();
  const service = document.getElementById('book-service').value;
  const date = document.getElementById('book-date').value;
  const obs = document.getElementById('book-obs').value.trim();

  if (!name) { showToast('Informe seu nome', true); return; }
  if (!phone) { showToast('Informe seu WhatsApp', true); return; }
  if (!service) { showToast('Selecione um serviço', true); return; }
  if (!date) { showToast('Selecione uma data', true); return; }

  const todayAppts = appointments.filter(a => a.date === date).length;
  if (todayAppts >= dailyLimit) {
    showToast('Agenda cheia para esta data! Escolha outra.', true); return;
  }

  const appt = {
    id: Date.now(),
    name, phone, service, date, obs,
    status: 'pendente',
    createdAt: new Date().toISOString()
  };
  appointments.push(appt);
  save('db_appointments', appointments);

  const waNum = waConfig.num;
  let msg = waConfig.msg.replace('{nome}', name).replace('{servico}', service);
  if (date) msg += ` Data: ${formatDate(date)}.`;
  if (obs) msg += ` Obs: ${obs}.`;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');

  if (emailConfig.dest && emailConfig.perBooking) {
    const emailBody = `Novo agendamento\n\nNome: ${name}\nWhatsApp: ${phone}\nServiço: ${service}\nData: ${formatDate(date)}\nObs: ${obs || '—'}\nHora: ${new Date().toLocaleTimeString('pt-BR')}`;
    window.open(`mailto:${emailConfig.dest}?subject=${encodeURIComponent(emailConfig.subject)}&body=${encodeURIComponent(emailBody)}`);
  }

  showToast('Agendamento enviado! Aguarde confirmação via WhatsApp.');
  checkAgendaStatus();
  document.getElementById('book-name').value = '';
  document.getElementById('book-phone').value = '';
  document.getElementById('book-service').value = '';
  document.getElementById('book-date').value = '';
  document.getElementById('book-obs').value = '';
}

// ─── UTILS ────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 3000);
}
function formatDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('book-date').min = today;

  renderPromos();
  checkAgendaStatus();

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});

// ─── MOBILE MENU ──────────────────────────────────────────────
function toggleMenu() {
  const navLinks = document.querySelector('.nav-links');
  navLinks.classList.toggle('mobile');
}
