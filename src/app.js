import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const root = document.querySelector("#root");
const today = dateString(new Date());
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = dateString(tomorrowDate);
const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const state = {
  db: null,
  user: null,
  section: "resumen",
  patients: [],
  appointments: [],
  expenses: [],
  date: today,
  period: "month",
  search: "",
  modal: null,
  notifications: "Notification" in window && Notification.permission === "granted",
  notified: false,
};

function dateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function longDate(value) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function shortDate(value) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function weekDates(value) {
  const start = new Date(`${value}T12:00:00`);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return dateString(date);
  });
}

function age(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const now = new Date();
  let result = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) result -= 1;
  return result;
}

function ageLabel(birthDate) {
  const years = age(birthDate);
  return years === null ? "Edad sin registrar" : `${years} años`;
}

function errorText(error) {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function icon(name, size = 18) {
  const paths = {
    home: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h.01"/><path d="M6 5V3h12v2"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    leaf: '<path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z"/><path d="M4 21c3-5 7-8 12-11"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
}

function setupView(message = "") {
  root.innerHTML = `<main class="auth-page"><section class="auth-card">
    <div class="brand-mark auth-brand-mark">${icon("leaf", 22)}</div>
    <span class="eyebrow">HUELLAS DE VIDA</span><h1>Conecta tu espacio</h1>
    <p>${message || "Crea config.json en la carpeta principal, copiando config.example.json y pegando la Publishable key de Supabase."}</p>
    <ol class="setup-steps"><li>Copia <code>config.example.json</code> y renombra la copia como <code>config.json</code>.</li>
      <li>En Supabase → Project Settings → API Keys, copia la Publishable key a <code>supabaseAnonKey</code>.</li>
      <li>Guarda el archivo y recarga Go Live.</li></ol>
    <div class="auth-security">${icon("shield", 16)} Usa solo la Publishable/anon key; nunca service_role.</div>
  </section></main>`;
}

function loadingView(message) {
  root.innerHTML = `<div class="auth-page"><div class="loading-card"><div class="loading-spinner"></div>${escapeHtml(message)}</div></div>`;
}

function loginView(error = "") {
  root.innerHTML = `<main class="auth-page"><section class="auth-card">
    <div class="brand-mark auth-brand-mark">${icon("leaf", 22)}</div>
    <span class="eyebrow">HUELLAS DE VIDA · PODÓLOGA ANABEL</span>
    <h1>Qué bueno tenerte de vuelta</h1><p>Inicia sesión para ver tu agenda y tus fichas.</p>
    <form class="login-form" id="login-form">
      <label class="form-field"><span>Correo electrónico</span><input name="email" type="email" autocomplete="username" required placeholder="tu@correo.cl"></label>
      <label class="form-field"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required placeholder="Tu contraseña"></label>
      ${error ? `<p class="login-error" role="alert">${escapeHtml(error)}</p>` : ""}
      <button class="button button-primary login-submit" type="submit">Iniciar sesión</button>
    </form><div class="auth-security">${icon("shield", 16)} Acceso privado para tu consulta.</div>
  </section></main>`;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Ingresando...";
    const { error: signInError } = await state.db.auth.signInWithPassword({
      email: String(form.get("email")), password: String(form.get("password")),
    });
    if (signInError) loginView(signInError.message);
  });
}

async function loadData() {
  const [patientResult, appointmentResult, expenseResult, sessionResult, photoResult] = await Promise.all([
    state.db.from("patients").select("*").order("full_name"),
    state.db.from("appointments").select("*").order("appointment_date").order("appointment_time"),
    state.db.from("expenses").select("*").order("expense_date", { ascending: false }),
    state.db.from("session_records").select("*"),
    state.db.from("session_photos").select("*"),
  ]);
  for (const result of [patientResult, appointmentResult, expenseResult, sessionResult, photoResult]) {
    if (result.error) throw result.error;
  }
  const sessions = new Map(sessionResult.data.map((item) => [item.appointment_id, item]));
  const photos = new Map();
  photoResult.data.forEach((item) => {
    const bucket = photos.get(item.session_id) || [];
    bucket.push(item.storage_path.split("/").at(-1));
    photos.set(item.session_id, bucket);
  });
  state.patients = patientResult.data.map((row) => ({
    id: row.id, name: row.full_name, nationalId: row.national_id || "",
    birthDate: row.birth_date || "", phone: row.phone, email: row.email || "",
    address: row.address || "", emergencyContact: row.emergency_contact || "",
    occupation: row.occupation || "", medicalHistory: row.medical_history || "",
    podiatryHistory: row.podiatry_history || "", allergies: row.allergies || "",
    medications: row.medications || "", observations: row.observations || "",
    createdAt: row.created_at.slice(0, 10),
  }));
  state.appointments = appointmentResult.data.map((row) => {
    const session = sessions.get(row.id);
    return {
      id: row.id, patientId: row.patient_id, date: row.appointment_date,
      time: row.appointment_time.slice(0, 5), price: row.price_clp,
      status: ({ scheduled: "Agendada", attended: "Atendida", cancelled: "Cancelada" })[row.status],
      cancellationReason: row.cancellation_reason || "",
      rescheduled: row.is_rescheduled,
      treatment: session?.treatment || "",
      sessionNotes: session?.description || "",
      photos: session ? photos.get(session.id) || [] : [],
    };
  });
  state.expenses = expenseResult.data.map((row) => ({
    id: row.id, date: row.expense_date, description: row.description,
    category: row.category, amount: row.amount_clp,
  }));
}

function patientName(id) {
  return state.patients.find((patient) => patient.id === id)?.name || "Paciente";
}

function statusClass(status) {
  return status.toLowerCase().replace("á", "a");
}

function empty(title, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon("leaf", 19)}</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function heading(eyebrow, title, description, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function appointmentRow(appointment, compact = false) {
  const name = patientName(appointment.patientId);
  return `<div class="appointment-row ${compact ? "appointment-row-compact" : ""}">
    <div class="appointment-time">${icon("clock", 14)}${appointment.time}</div>
    <div class="appointment-avatar">${escapeHtml(name.slice(0, 1))}</div>
    <div class="appointment-person"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(appointment.treatment || "Atención podológica")}${appointment.rescheduled ? " · Reprogramada" : ""}</span></div>
    <div class="appointment-price">${money.format(appointment.price)}</div>
    <span class="status-badge status-${statusClass(appointment.status)}">${appointment.status}</span>
    ${appointment.status === "Agendada" ? `<button class="icon-button row-check" data-action="session" data-id="${appointment.id}" title="Registrar atención">${icon("check", 16)}</button>` : ""}
  </div>`;
}

function dashboard() {
  const todayAppointments = state.appointments.filter((item) => item.date === today);
  const finished = todayAppointments.filter((item) => item.status === "Atendida");
  const income = finished.reduce((sum, item) => sum + item.price, 0);
  const expenseToday = state.expenses.filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
  const nextDay = state.appointments.filter((item) => item.date === tomorrow && item.status === "Agendada");
  const displayName = (state.user.user_metadata.full_name || state.user.email?.split("@")[0] || "Anabel").split(/[ .@]/)[0];
  return `${heading(longDate(today), `Hola, ${escapeHtml(displayName)} ✨`, "Un día nuevo para cuidar y acompañar.")}
    <section class="welcome-panel"><div class="welcome-copy"><span class="welcome-kicker">✦ TU CONSULTA, A TU RITMO</span>
      <h2>Cada paso cuenta<br>en el camino al bienestar.</h2><p>Organiza tus citas, cuida tus fichas y mantén todo en un mismo lugar.</p>
      <button class="button button-light" data-nav="agenda">Ver mi agenda ${icon("arrow", 16)}</button></div>
      <div class="welcome-illustration" aria-hidden="true"><div class="sun-disc"></div><div class="illustration-leaf leaf-one"></div><div class="illustration-leaf leaf-two"></div><div class="illustration-leaf leaf-three"></div><div class="illustration-feet">♡</div><span class="sparkle sparkle-a">✦</span><span class="sparkle sparkle-b">✧</span></div><div class="welcome-decoration">✿</div></section>
    <section class="stats-grid">
      ${stat("Citas de hoy", todayAppointments.length, `${finished.length} atendidas`, "calendar", "green")}
      ${stat("Ingresos de hoy", money.format(income), "Solo citas atendidas", "arrow", "rose")}
      ${stat("Gastos de hoy", money.format(expenseToday), "Insumos y otros gastos", "wallet", "gold")}
    </section>
    <div class="dashboard-columns"><section class="surface-card today-card">
      <div class="card-heading"><div><h3>Tu agenda de hoy</h3><p>${shortDate(today)} · ${todayAppointments.length} citas</p></div><button class="text-button" data-nav="agenda">Ver agenda ${icon("arrow", 15)}</button></div>
      ${todayAppointments.length ? `<div class="appointment-list compact-list">${todayAppointments.slice().sort((a,b)=>a.time.localeCompare(b.time)).map((item)=>appointmentRow(item,true)).join("")}</div>` : empty("Día despejado","Todavía no tienes citas para hoy.")}
      <button class="button button-outline add-today-button" data-modal="appointment">${icon("plus", 16)} Agendar una cita</button></section>
      <aside class="dashboard-side"><section class="surface-card reminder-card"><div class="reminder-header"><div class="reminder-icon">${icon("bell",18)}</div><span class="reminder-time">20:00</span></div>
        <h3>Un recordatorio para mañana</h3><p>Recibe la lista de pacientes del día siguiente cada noche.</p>
        <div class="tomorrow-summary"><div class="tomorrow-date">${icon("calendar",15)} ${shortDate(tomorrow)}</div><strong>${nextDay.length} <small>${nextDay.length===1?"paciente":"pacientes"}</small></strong></div>
        <button class="button ${state.notifications?"button-success":"button-dark-green"}" data-action="notifications">${icon("bell",15)} ${state.notifications?"Recordatorios activados":"Activar recordatorios"}</button>
        <span class="notification-note">La página debe permanecer abierta para recibirlo.</span></section>
        <section class="soft-note"><div class="soft-note-icon">${icon("heart",16)}</div><p><strong>Un pequeño recordatorio:</strong><br>tu cuidado también importa. Haz una pausa cuando la necesites.</p></section></aside></div>`;
}

function stat(label, value, note, glyph, tone) {
  return `<div class="surface-card stat-card"><div class="stat-icon stat-${tone}">${icon(glyph,18)}</div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;
}

function agenda() {
  const dates = weekDates(state.date);
  const weekAppointments = state.appointments
    .filter((item) => dates.includes(item.date))
    .sort((a, b) => a.time.localeCompare(b.time));
  const scheduled = weekAppointments.filter((item) => item.status === "Agendada").length;
  const attended = weekAppointments.filter((item) => item.status === "Atendida").length;
  const cancelled = weekAppointments.filter((item) => item.status === "Cancelada").length;
  return `${heading("ORGANIZA TU SEMANA","Agenda","Vista semanal · cada día ordenado por hora, sin duración fija.",`<button class="button button-primary" data-modal="appointment">${icon("plus",17)} Nueva cita</button>`)}
    <section class="surface-card agenda-panel"><div class="agenda-toolbar"><div><span class="eyebrow">VISTA SEMANAL</span><h2>${shortDate(dates[0])} – ${shortDate(dates[6])}</h2></div>
      <div class="date-nav"><button class="icon-button" aria-label="Semana anterior" data-action="prev-week">${icon("left",17)}</button><button class="button button-date" data-action="today">Hoy</button><input class="date-picker-input" aria-label="Elegir semana" type="date" id="date-picker" value="${state.date}"><button class="icon-button" aria-label="Semana siguiente" data-action="next-week">${icon("right",17)}</button></div></div>
      <div class="agenda-summary-strip"><span>${weekAppointments.length} citas esta semana</span><span><span class="mini-dot dot-sage"></span>${scheduled} agendadas</span><span><span class="mini-dot dot-mint"></span>${attended} atendidas</span><span><span class="mini-dot dot-rose"></span>${cancelled} canceladas</span></div>
      <div class="week-scroll"><div class="week-grid">${dates.map((date)=>weekColumn(date)).join("")}</div></div></section>
      <p class="agenda-footnote">${icon("leaf",15)} Selecciona un día para agendar. Las citas se muestran por hora y no ocupan bloques de duración.</p>`;
}

function weekColumn(date) {
  const items = state.appointments.filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const day = new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "");
  const selected = date === state.date;
  const isToday = date === today;
  return `<section class="week-day ${selected ? "week-day-selected" : ""} ${isToday ? "week-day-today" : ""}">
    <button class="week-day-heading" data-action="select-day" data-date="${date}">
      <span>${day}</span><strong>${new Date(`${date}T12:00:00`).getDate()}</strong><small>${items.length ? `${items.length} ${items.length===1?"cita":"citas"}` : "Sin citas"}</small>
    </button>
    <div class="week-day-events">${items.length ? items.map(weekEvent).join("") : `<button class="week-empty" data-action="new-appointment-day" data-date="${date}">${icon("plus",14)} Agendar</button>`}</div>
  </section>`;
}

function weekEvent(item) {
  const name = patientName(item.patientId);
  return `<article class="week-event status-${statusClass(item.status)}">
    <div class="week-event-top"><strong>${item.time}</strong><span>${item.status}</span></div>
    <div class="week-event-patient">${escapeHtml(name)}</div>
    <div class="week-event-price">${money.format(item.price)}</div>
    ${item.rescheduled?'<small class="rescheduled-tag">Reprogramada</small>':""}
    ${item.cancellationReason?`<small class="cancellation-reason">Motivo: ${escapeHtml(item.cancellationReason)}</small>`:""}
    ${item.status==="Agendada"?`<div class="week-event-actions"><button title="Marcar atendida" aria-label="Marcar atendida" data-action="session" data-id="${item.id}">${icon("check",14)}</button><button title="Reprogramar" aria-label="Reprogramar" data-action="reschedule" data-id="${item.id}">↻</button><button title="Cancelar" aria-label="Cancelar" data-action="cancel" data-id="${item.id}">${icon("close",14)}</button></div>`:""}
  </article>`;
}

function patientsView() {
  const patients = state.patients.filter((item) => item.name.toLowerCase().includes(state.search.toLowerCase()));
  return `${heading("CUIDADO PERSONALIZADO","Mis pacientes","Fichas ordenadas y antecedentes a mano para cada atención.",`<button class="button button-primary" data-modal="patient">${icon("plus",17)} Nuevo paciente</button>`)}
    <section class="surface-card patients-panel"><div class="list-toolbar"><div><strong>${patients.length} pacientes</strong><span> en tu ficha clínica</span></div>
    <label class="search-field">${icon("search",16)}<input id="patient-search" value="${escapeHtml(state.search)}" placeholder="Buscar paciente"></label></div>
    ${patients.length?`<div class="patient-list">${patients.map((patient,index)=>`<button class="patient-row" data-action="patient-detail" data-id="${patient.id}">
      <div class="patient-avatar avatar-${index%4}">${escapeHtml(patient.name.slice(0,1))}</div><div class="patient-main"><strong>${escapeHtml(patient.name)}</strong><span>${ageLabel(patient.birthDate)} · ${escapeHtml(patient.phone)}</span></div>
      <div class="patient-registered"><small>Ficha creada</small><span>${shortDate(patient.createdAt)}</span></div>${icon("right",17)}</button>`).join("")}</div>`:empty("No encontramos pacientes","Prueba con otro nombre o agrega una nueva ficha.")}</section>
    <div class="privacy-note">${icon("shield",17)}<span><strong>Ficha clínica confidencial</strong><br>El acceso está protegido por tu cuenta y las políticas de Supabase.</span></div>`;
}

function finance() {
  const range = new Date();
  if (state.period === "week") range.setDate(range.getDate()-6);
  if (state.period === "month") range.setDate(1);
  const start = dateString(range);
  const incomeRows = state.appointments.filter((item)=>item.status==="Atendida"&&item.date>=start&&item.date<=today);
  const expenseRows = state.expenses.filter((item)=>item.date>=start&&item.date<=today);
  const income = incomeRows.reduce((sum,item)=>sum+item.price,0);
  const expenseTotal = expenseRows.reduce((sum,item)=>sum+item.amount,0);
  const label = {day:"Hoy",week:"Últimos 7 días",month:"Este mes"}[state.period];
  return `${heading("TU TRABAJO, EN EQUILIBRIO","Ingresos y gastos","Lleva un registro sencillo de tus atenciones y compras.",`<button class="button button-primary" data-modal="expense">${icon("plus",17)} Registrar gasto</button>`)}
    <section class="finance-toolbar"><div class="period-tabs">${["day","week","month"].map((item)=>`<button class="${state.period===item?"period-active":""}" data-period="${item}">${{day:"Día",week:"Semana",month:"Mes"}[item]}</button>`).join("")}</div><span>${label} · valores en pesos chilenos</span></section>
    <section class="finance-stats">${financeStat("Ingresos registrados",money.format(income),`${incomeRows.length} citas atendidas`,"arrow","finance-green")}${financeStat("Gastos registrados",money.format(expenseTotal),`${expenseRows.length} compras o gastos`,"wallet","finance-rose")}${financeStat("Balance del período",money.format(income-expenseTotal),"Ingresos menos gastos","wallet","finance-gold finance-net")}</section>
    <div class="finance-columns"><section class="surface-card finance-list"><div class="card-heading"><div><h3>Atenciones</h3><p>Ingresos de las citas atendidas</p></div><span class="list-count">${incomeRows.length}</span></div>
      ${incomeRows.length?incomeRows.slice().reverse().map((item)=>`<div class="transaction-row"><div class="transaction-mark transaction-in">${icon("check",15)}</div><div class="transaction-info"><strong>${escapeHtml(patientName(item.patientId))}</strong><span>${shortDate(item.date)} · ${item.time}</span></div><strong class="transaction-amount">${money.format(item.price)}</strong></div>`).join(""):empty("Sin ingresos todavía","Al marcar una cita como atendida, su precio aparecerá aquí.")}</section>
      <section class="surface-card finance-list"><div class="card-heading"><div><h3>Gastos</h3><p>Insumos y otros gastos</p></div><span class="list-count">${expenseRows.length}</span></div>
      ${expenseRows.length?expenseRows.slice().reverse().map((item)=>`<div class="transaction-row"><div class="transaction-mark transaction-out">${icon("arrow",15)}</div><div class="transaction-info"><strong>${escapeHtml(item.description)}</strong><span>${escapeHtml(item.category)} · ${shortDate(item.date)}</span></div><strong class="transaction-amount">${money.format(item.amount)}</strong></div>`).join(""):empty("Sin gastos todavía","Registra una compra para iniciar tu resumen.")}</section></div>`;
}

function financeStat(label, value, note, glyph, tone) {
  return `<div class="surface-card finance-card ${tone.includes("net")?"finance-net":""}"><span>${label}</span><strong>${value}</strong><small>${note}</small><div class="finance-icon ${tone.split(" ")[0]}">${icon(glyph,18)}</div></div>`;
}

function workspace() {
  const sections = [
    ["resumen","Resumen","home"],["agenda","Agenda","calendar"],
    ["pacientes","Pacientes","users"],["gastos","Ingresos y gastos","wallet"],
  ];
  const scheduledToday = state.appointments.filter((item)=>item.date===today&&item.status==="Agendada").length;
  let content = state.section==="resumen"?dashboard():state.section==="agenda"?agenda():state.section==="pacientes"?patientsView():finance();
  root.innerHTML = `<div class="app-shell"><aside class="sidebar ${state.menuOpen?"sidebar-open":""}">
    <div class="brand"><div class="brand-mark">${icon("leaf",22)}</div><div class="brand-copy"><span>HUELLAS DE VIDA</span><small>Podología Anabel</small></div><button class="icon-button sidebar-close" data-action="close-menu" aria-label="Cerrar menú">${icon("close",18)}</button></div>
    <div class="nav-caption">MENÚ PRINCIPAL</div><nav class="main-nav" aria-label="Menú principal">${sections.map(([id,label,glyph])=>`<button class="nav-item ${state.section===id?"nav-item-active":""}" data-nav="${id}">${icon(glyph,19)}<span>${label}</span>${id==="agenda"&&scheduledToday?`<span class="nav-count">${scheduledToday}</span>`:""}</button>`).join("")}</nav>
    <div class="sidebar-bottom"><div class="care-card"><div class="care-icon">${icon("heart",17)}</div><p>Un paso a la vez,<br><strong>cuidando de ti.</strong></p><div class="care-flower">✿</div></div>
    <div class="profile-card"><div class="avatar">AB</div><div class="profile-copy"><strong>${escapeHtml(state.user.user_metadata.full_name||"Anabel Bugueño")}</strong><small>${escapeHtml(state.user.email||"")}</small></div><button class="icon-button" data-action="signout" aria-label="Cerrar sesión">${icon("logout",17)}</button></div></div></aside>
    ${state.menuOpen?'<button class="mobile-backdrop" data-action="close-menu" aria-label="Cerrar menú"></button>':""}
    <main class="main-area"><header class="topbar"><button class="icon-button menu-toggle" data-action="toggle-menu" aria-label="Abrir menú">☰</button><div class="breadcrumb"><span>Mi espacio</span><span class="breadcrumb-separator">/</span><strong>${sections.find((item)=>item[0]===state.section)?.[1]}</strong></div>
    <div class="topbar-actions"><span class="today-pill"><span class="live-dot"></span> Tu consulta</span><button class="icon-button bell-button" data-action="notifications" aria-label="Recordatorios">${icon("bell",19)}${state.appointments.some((item)=>item.date===tomorrow&&item.status==="Agendada")?'<span class="bell-dot"></span>':""}</button></div></header>
    <div class="page-content"><div class="demo-banner">${icon("shield",17)}<span><strong>Espacio privado.</strong> Tus fichas se guardan en tu cuenta de Supabase.</span></div>${content}
    <footer class="page-footer"><span>${icon("leaf",14)} Un espacio para cuidar de quienes caminan contigo.</span><span>Huellas de Vida <span class="footer-heart">♥</span></span></footer></div></main>
    ${state.modal?modalMarkup():""}<div id="toast-container"></div></div>`;
  const modalForm=document.querySelector("#modal-form");
  if(modalForm) modalForm.addEventListener("submit",submitModal);
}

function field(label, name, type = "text", options = {}) {
  const { required = false, placeholder = "", value = "", rows = 2, full = false, max = "" } = options;
  const attr = `name="${name}" ${required?"required":""} ${max?`max="${max}"`:""}`;
  let control;
  if (type === "textarea") control = `<textarea ${attr} rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`;
  else control = `<input ${attr} type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`;
  return `<label class="form-field ${full?"form-full":""}"><span>${label}${required?" *":""}</span>${control}</label>`;
}

function modalMarkup() {
  const modal = state.modal;
  const appointment = state.appointments.find((item)=>item.id===modal.id);
  const patient = state.patients.find((item)=>item.id===modal.id);
  let title = "Nueva cita";
  let subtitle = "Anota el día, la hora y el valor de la atención.";
  let body = "";
  let action = "Guardar";
  if (modal.type === "patient") {
    title = "Nuevo paciente"; subtitle = "Puedes completar la ficha ahora o más adelante."; action = "Guardar ficha";
    body = patientFields();
  } else if (modal.type === "quick-patient") {
    title = "Nuevo paciente"; subtitle = "Para agendar, basta con su nombre y teléfono."; action = "Guardar y continuar";
    body = `<div class="form-grid">${field("Nombre completo","name","text",{required:true,full:true,placeholder:"Nombre y apellidos"})}${field("Teléfono","phone","tel",{required:true,full:true,placeholder:"+56 9 1234 5678"})}</div><p class="form-hint">${icon("shield",14)} Después podrás completar y editar el resto de la ficha.</p><div class="form-error" id="form-error" role="alert" hidden></div>`;
  } else if (modal.type === "patient-edit" && patient) {
    title = "Editar ficha"; subtitle = "Actualiza los datos personales y antecedentes."; action = "Guardar cambios";
    body = patientFields(patient);
  } else if (modal.type === "appointment") {
    title = "Nueva cita"; action = "Agendar cita";
    body = `<div class="form-grid"><div class="form-full"><label class="form-field"><span>Paciente *</span><select name="patientId" required><option value="">Selecciona un paciente</option>${state.patients.map((item)=>`<option value="${item.id}" ${item.id===modal.patientId?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}</select></label><button type="button" class="text-button quick-patient-button" data-action="quick-patient">＋ Nuevo paciente (solo nombre y teléfono)</button></div>${field("Fecha","date","date",{required:true,value:modal.date||state.date})}${field("Hora","time","time",{required:true,value:modal.time||"09:00"})}${field("Precio de la atención (CLP)","price","number",{required:true,placeholder:"Ej. 20000",full:true,value:modal.price||""})}</div><div class="form-error" id="form-error" role="alert" hidden></div>`;
  } else if (modal.type === "expense") {
    title = "Registrar gasto"; subtitle = "Anota una compra para tus finanzas."; action = "Guardar gasto";
    body = `<div class="form-grid">${field("Descripción","description","text",{required:true,full:true,placeholder:"Ej. Material para atención"})}<label class="form-field"><span>Categoría *</span><select name="category"><option>Insumos clínicos</option><option>Implementos</option><option>Transporte</option><option>Servicios</option><option>Otro</option></select></label>${field("Monto (CLP)","amount","number",{required:true,placeholder:"Ej. 15000"})}${field("Fecha","date","date",{required:true,value:today,max:today,full:true})}</div>`;
  } else if (modal.type === "session" && appointment) {
    title = "Registrar atención"; subtitle = `Sesión de ${escapeHtml(patientName(appointment.patientId))}.`; action = "Guardar y marcar atendida";
    body = `<div class="session-meta"><span>${icon("users",15)} ${escapeHtml(patientName(appointment.patientId))}</span><span>${icon("calendar",15)} ${shortDate(appointment.date)} · ${appointment.time}</span><strong>${money.format(appointment.price)}</strong></div><div class="form-grid">${field("Tratamiento realizado","treatment","text",{required:true,placeholder:"Ej. Corte y limado",full:true})}${field("Descripción de la sesión","description","textarea",{rows:4,placeholder:"Hallazgos y recomendaciones",full:true})}<label class="form-field form-full"><span>Fotos de la sesión</span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small class="input-note">JPG, PNG o WebP · máximo 10 MB por foto.</small></label></div>`;
  } else if (modal.type === "cancel" && appointment) {
    title = "Cancelar cita"; subtitle = `Deja registrado el motivo de ${escapeHtml(patientName(appointment.patientId))}.`; action = "Confirmar cancelación";
    body = `<label class="form-field"><span>Motivo de cancelación *</span><textarea name="reason" rows="4" required placeholder="¿Por qué se canceló esta cita?"></textarea></label>`;
  } else if (modal.type === "reschedule" && appointment) {
    title = "Reprogramar cita"; subtitle = `Cita de ${escapeHtml(patientName(appointment.patientId))}.`; action = "Guardar nueva fecha";
    body = `<div class="form-grid">${field("Nueva fecha","date","date",{required:true,value:appointment.date})}${field("Nueva hora","time","time",{required:true,value:appointment.time})}</div>`;
  } else if (modal.type === "patient-detail" && patient) {
    const sessions = state.appointments.filter((item)=>item.patientId===patient.id&&item.status==="Atendida").sort((a,b)=>b.date.localeCompare(a.date));
    title = escapeHtml(patient.name); subtitle = "Ficha clínica y registro de atenciones.";
    body = `<div class="patient-details"><div class="detail-topline"><div class="detail-avatar">${escapeHtml(patient.name.slice(0,1))}</div><div><strong>${ageLabel(patient.birthDate)}</strong><span>${escapeHtml(patient.phone)}</span><span>${escapeHtml(patient.address)}</span></div><button class="button button-outline" data-action="edit-patient" data-id="${patient.id}">Editar ficha</button><button class="button button-primary" data-action="schedule-patient" data-id="${patient.id}">${icon("plus",15)} Agendar</button></div><div class="detail-grid">${detail("Fecha de nacimiento",patient.birthDate?shortDate(patient.birthDate):"No informado")}${detail("RUT",patient.nationalId)}${detail("Correo electrónico",patient.email)}${detail("Contacto de emergencia",patient.emergencyContact)}${detail("Ocupación",patient.occupation)}${detail("Antecedentes médicos",patient.medicalHistory)}${detail("Antecedentes podológicos",patient.podiatryHistory)}${detail("Alergias",patient.allergies)}${detail("Medicamentos",patient.medications)}${detail("Observaciones",patient.observations)}</div><div class="history-section"><div class="card-heading"><div><h3>Historial de sesiones</h3><p>${sessions.length} atenciones registradas</p></div></div>${sessions.length?sessions.map((item)=>`<div class="history-row"><div><strong>${shortDate(item.date)} · ${item.time}</strong><span>${escapeHtml(item.treatment)}${item.sessionNotes?` — ${escapeHtml(item.sessionNotes)}`:""}</span>${item.photos?.length?`<small>Fotos: ${item.photos.map(escapeHtml).join(", ")}</small>`:""}</div><strong>${money.format(item.price)}</strong></div>`).join(""):'<p class="history-empty">Aquí aparecerá el historial de sesiones.</p>'}</div></div>`;
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal-card modal-wide" role="dialog" aria-modal="true"><div class="modal-heading"><div><span class="eyebrow">FICHA CLÍNICA</span><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-modal">${icon("close",19)}</button></div>${body}</section></div>`;
  }
  const destructive = modal.type === "cancel";
  const wide = ["patient","patient-edit"].includes(modal.type);
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal-card ${wide?"modal-wide":""}" role="dialog" aria-modal="true"><div class="modal-heading"><div><span class="eyebrow">HUELLAS DE VIDA</span><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-modal">${icon("close",19)}</button></div>
    <form id="modal-form" data-form="${modal.type}" data-id="${modal.id||""}">${body}${["patient","patient-edit","quick-patient"].includes(modal.type)?"":'<div class=\"form-error\" id=\"form-error\" role=\"alert\" hidden></div>'}<div class="modal-actions"><button type="button" class="button button-outline" data-action="close-modal">Volver</button><button type="submit" class="button ${destructive?"button-danger":"button-primary"}">${action}</button></div></form></section></div>`;
}

function patientFields(patient = {}) {
  return `<div class="form-grid">${field("Nombre completo","name","text",{required:true,full:true,placeholder:"Nombre y apellidos",value:patient.name||""})}${field("RUT","nationalId","text",{placeholder:"12.345.678-9",value:patient.nationalId||""})}${field("Fecha de nacimiento","birthDate","date",{max:today,value:patient.birthDate||""})}${field("Teléfono","phone","tel",{required:true,placeholder:"+56 9 1234 5678",value:patient.phone||""})}${field("Correo electrónico","email","email",{placeholder:"nombre@correo.cl",value:patient.email||""})}${field("Dirección","address","text",{full:true,placeholder:"Calle, número, comuna",value:patient.address||""})}${field("Contacto de emergencia","emergencyContact","text",{placeholder:"Nombre y teléfono",value:patient.emergencyContact||""})}${field("Ocupación","occupation","text",{placeholder:"Ocupación (opcional)",value:patient.occupation||""})}${field("Antecedentes médicos","medicalHistory","textarea",{placeholder:"Diabetes, hipertensión, cirugías...",value:patient.medicalHistory||""})}${field("Antecedentes podológicos","podiatryHistory","textarea",{placeholder:"Tratamientos anteriores",value:patient.podiatryHistory||""})}${field("Alergias","allergies","textarea",{placeholder:"Alergias conocidas o ninguna",value:patient.allergies||""})}${field("Medicamentos","medications","textarea",{placeholder:"Medicamentos actuales",value:patient.medications||""})}${field("Observaciones","observations","textarea",{placeholder:"Notas importantes",value:patient.observations||""})}</div><p class="form-hint">${icon("shield",14)} Esta ficha se guarda en tu espacio privado.</p><div class="form-error" id="form-error" role="alert" hidden></div>`;
}

function detail(label, value) {
  return `<div class="detail-item"><span>${label}</span><strong>${escapeHtml(value||"No informado")}</strong></div>`;
}

function toast(message) {
  const holder = document.querySelector("#toast-container");
  if (!holder) return;
  holder.innerHTML = `<div class="toast">${icon("check",16)}${escapeHtml(message)}</div>`;
  window.setTimeout(()=>{ if(holder.isConnected) holder.innerHTML=""; },3500);
}

function render() {
  if (!state.user) return loginView();
  workspace();
}

async function submitModal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = form.dataset.form === "quick-patient" ? "Guardando paciente..." : "Guardando...";
  try {
    if (form.dataset.form === "patient" || form.dataset.form === "patient-edit") {
      const patientFields = {
        national_id:data.get("nationalId")||null,
        full_name:String(data.get("name")).trim(),
        birth_date:data.get("birthDate")||null,
        phone:String(data.get("phone")).trim(),
        email:data.get("email")||null,
        address:data.get("address")||null,
        emergency_contact:data.get("emergencyContact")||null,
        occupation:data.get("occupation")||null,
        medical_history:data.get("medicalHistory")||null,
        podiatry_history:data.get("podiatryHistory")||null,
        allergies:data.get("allergies")||null,
        medications:data.get("medications")||null,
        observations:data.get("observations")||null,
      };
      const result = form.dataset.form === "patient-edit"
        ? await state.db.from("patients").update(patientFields).eq("id",form.dataset.id)
        : await state.db.from("patients").insert({...patientFields,user_id:state.user.id});
      const {error}=result;
      if(error) throw error;
      state.modal=null; await loadData(); render(); toast(form.dataset.form==="patient-edit"?"Ficha actualizada":"Ficha guardada");
    } else if (form.dataset.form === "quick-patient") {
      const {data:patient,error}=await state.db.from("patients").insert({
        user_id:state.user.id,
        full_name:String(data.get("name")).trim(),
        phone:String(data.get("phone")).trim(),
      }).select("id").single();
      if(error) throw error;
      const appointmentDraft=state.modal.appointmentDraft||{};
      state.modal={
        type:"appointment",
        patientId:patient.id,
        date:appointmentDraft.date||state.date,
        time:appointmentDraft.time||"09:00",
        price:appointmentDraft.price||"",
      };
      await loadData();render();toast("Paciente creado; completa la cita.");
    } else if (form.dataset.form === "appointment") {
      const {error}=await state.db.from("appointments").insert({
        user_id:state.user.id,patient_id:data.get("patientId"),appointment_date:data.get("date"),
        appointment_time:data.get("time"),price_clp:Number(data.get("price")),
      });
      if(error) throw error;
      state.modal=null;await loadData();render();toast("Cita guardada en la agenda");
    } else if (form.dataset.form === "expense") {
      const {error}=await state.db.from("expenses").insert({
        user_id:state.user.id,expense_date:data.get("date"),description:String(data.get("description")).trim(),
        category:data.get("category"),amount_clp:Number(data.get("amount")),
      });
      if(error) throw error;
      state.modal=null;await loadData();render();toast("Gasto guardado");
    } else if (form.dataset.form === "session") {
      const appointment=state.appointments.find((item)=>item.id===form.dataset.id);
      const {data:session,error:sessionError}=await state.db.from("session_records").upsert({
        user_id:state.user.id,appointment_id:appointment.id,
        treatment:String(data.get("treatment")).trim(),description:String(data.get("description")).trim()||null,
      },{onConflict:"user_id,appointment_id"}).select("id").single();
      if(sessionError) throw sessionError;
      for(const file of data.getAll("photos")){
        if(!file.size) continue;
        if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error(`Formato no permitido: ${file.name}`);
        if(file.size>10*1024*1024) throw new Error(`${file.name} supera 10 MB.`);
        const path=`${state.user.id}/${session.id}/${crypto.randomUUID()}.${file.name.split(".").at(-1)||"jpg"}`;
        const uploaded=await state.db.storage.from("session-photos").upload(path,file,{contentType:file.type});
        if(uploaded.error) throw uploaded.error;
        const saved=await state.db.from("session_photos").insert({user_id:state.user.id,session_id:session.id,storage_path:path});
        if(saved.error) throw saved.error;
      }
      const {error}=await state.db.from("appointments").update({status:"attended"}).eq("id",appointment.id);
      if(error) throw error;
      state.modal=null;await loadData();render();toast("Sesión guardada");
    } else if (form.dataset.form === "cancel") {
      const {error}=await state.db.from("appointments").update({status:"cancelled",cancellation_reason:String(data.get("reason")).trim()}).eq("id",form.dataset.id);
      if(error) throw error;
      state.modal=null;await loadData();render();toast("Cita cancelada");
    } else if (form.dataset.form === "reschedule") {
      const {error}=await state.db.from("appointments").update({
        appointment_date:data.get("date"),appointment_time:data.get("time"),is_rescheduled:true,
      }).eq("id",form.dataset.id);
      if(error) throw error;
      state.modal=null;await loadData();render();toast("Cita reprogramada");
    }
  } catch(error) {
    submit.disabled=false;
    submit.textContent=originalLabel;
    const errorBox=form.querySelector("#form-error");
    if(errorBox){
      errorBox.textContent=`No se pudo guardar: ${errorText(error)}`;
      errorBox.hidden=false;
    }else toast(`No se pudo guardar: ${errorText(error)}`);
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) return toast("Este navegador no permite notificaciones.");
  const permission=await Notification.requestPermission();
  state.notifications=permission==="granted";
  render();
  toast(permission==="granted"?"Recordatorio activado para las 20:00":"No se concedió permiso.");
}

function scheduleReminder() {
  window.setInterval(()=>{
    if(!state.user||!state.notifications||new Date().getHours()<20||state.notified) return;
    state.notified=true;
    const next=state.appointments.filter((item)=>item.date===tomorrow&&item.status==="Agendada");
    new Notification(`Agenda de mañana · ${next.length} pacientes`,{
      body:next.map((item)=>`${item.time} · ${patientName(item.patientId)}`).join("\n")||"No tienes pacientes agendados.",
      icon:"public/favicon.svg",
    });
  },30000);
}

root.addEventListener("click", async (event)=>{
  const target=event.target.closest("[data-nav],[data-modal],[data-action],[data-period]");
  if(!target) return;
  if(target.dataset.nav){state.section=target.dataset.nav;state.menuOpen=false;render();return;}
  if(target.dataset.modal){state.modal={type:target.dataset.modal,date:state.date};render();return;}
  if(target.dataset.period){state.period=target.dataset.period;render();return;}
  const {action,id}=target.dataset;
  if(action==="close-modal"){state.modal=null;render();}
  else if(action==="backdrop"&&event.target===target){state.modal=null;render();}
  else if(action==="toggle-menu"){state.menuOpen=true;render();}
  else if(action==="close-menu"){state.menuOpen=false;render();}
  else if(action==="today"){state.date=today;render();}
  else if(action==="prev-week"||action==="next-week"){
    const date=new Date(`${state.date}T12:00:00`);date.setDate(date.getDate()+(action==="next-week"?7:-7));state.date=dateString(date);render();
  } else if(action==="select-day"){
    state.date=target.dataset.date;render();
  } else if(action==="new-appointment-day"){
    state.date=target.dataset.date;state.modal={type:"appointment",date:state.date};render();
  } else if(action==="notifications") await enableNotifications();
  else if(action==="signout"){const {error}=await state.db.auth.signOut();if(error)toast(error.message);}
  else if(action==="session"||action==="cancel"||action==="reschedule"){state.modal={type:action,id};render();}
  else if(action==="patient-detail"){state.modal={type:"patient-detail",id};render();}
  else if(action==="edit-patient"){state.modal={type:"patient-edit",id};render();}
  else if(action==="quick-patient"){
    const form=document.querySelector("#modal-form");
    const data=new FormData(form);
    state.modal={
      type:"quick-patient",
      appointmentDraft:{
        date:String(data.get("date")||state.date),
        time:String(data.get("time")||"09:00"),
        price:String(data.get("price")||""),
      },
    };
    render();
  }
  else if(action==="schedule-patient"){state.modal={type:"appointment",patientId:id,date:state.date};render();}
});

root.addEventListener("change",(event)=>{
  if(event.target.id==="date-picker"){state.date=event.target.value;render();}
});
root.addEventListener("input",(event)=>{
  if(event.target.id==="patient-search"){
    const cursor=event.target.selectionStart;
    state.search=event.target.value;
    const page=document.querySelector(".page-content");
    const section=page.querySelector(".patients-panel");
    const html=patientsView();
    const wrapper=document.createElement("div");
    wrapper.innerHTML=html;
    const newPanel=wrapper.querySelector(".patients-panel");
    section.replaceWith(newPanel);
    const input=document.querySelector("#patient-search");
    input.focus();input.setSelectionRange(cursor,cursor);
  }
});
async function start() {
  let config;
  try {
    const response=await fetch("config.json",{cache:"no-store"});
    if(!response.ok) return setupView();
    config=await response.json();
  } catch {
    return setupView();
  }
  if(!config.supabaseUrl||!config.supabaseAnonKey||config.supabaseAnonKey.startsWith("PEGA_AQUI")){
    return setupView();
  }
  state.db=createClient(config.supabaseUrl,config.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  });
  loadingView("Comprobando acceso...");
  const {data,error}=await state.db.auth.getSession();
  if(error) return setupView(error.message);
  state.user=data.session?.user||null;
  state.db.auth.onAuthStateChange((_event,session)=>{
    state.user=session?.user||null;
    if(state.user){
      loadingView("Cargando tus fichas y agenda...");
      loadData().then(()=>{render();scheduleReminder();}).catch((loadError)=>setupView(errorText(loadError)));
    }else render();
  });
  if(!state.user) return loginView();
  loadingView("Cargando tus fichas y agenda...");
  try{await loadData();render();scheduleReminder();}
  catch(loadError){setupView(errorText(loadError));}
}

start();
