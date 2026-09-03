// Daftar poli. `priority: true` berarti setiap tiket dari poli ini otomatis
// masuk jalur prioritas (IGD) — bukan sesuatu yang bisa dicentang pasien
// sendiri, supaya jalur darurat tidak bisa disalahgunakan untuk menyerobot.
//
// `schedule` menentukan kapan dokter praktik. IGD tidak punya schedule
// (artinya selalu buka, 24 jam). Poli lain tutup otomatis di luar jam
// praktik — mengambil nomor pun tidak bisa dilakukan.
export const DEPARTMENTS = [
  { code: 'IGD', name: 'IGD — Gawat Darurat', priority: true, schedule: null },
  { code: 'UMM', name: 'Poli Umum', priority: false, schedule: [{ days: [1, 2, 3, 4, 5], start: '08:00', end: '20:00' }, { days: [6], start: '08:00', end: '14:00' }] },
  { code: 'GGI', name: 'Poli Gigi', priority: false, schedule: [{ days: [1, 3, 5], start: '09:00', end: '15:00' }] },
  { code: 'ANK', name: 'Poli Anak', priority: false, schedule: [{ days: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' }] },
  { code: 'MTA', name: 'Poli Mata', priority: false, schedule: [{ days: [2, 4], start: '09:00', end: '14:00' }] },
  { code: 'JTG', name: 'Poli Jantung', priority: false, schedule: [{ days: [1, 2, 3, 4, 5], start: '10:00', end: '15:00' }] },
];

export function findDepartment(code) {
  return DEPARTMENTS.find((d) => d.code === code) ?? null;
}

export function formatTicketNumber(deptCode, seq) {
  return `${deptCode}-${String(seq).padStart(3, '0')}`;
}

// --- Jadwal dokter --------------------------------------------------------
//
// Vercel functions bisa jalan di server dengan timezone apa saja (biasanya
// UTC), jadi hari & jam "sekarang" dihitung eksplisit dalam zona Asia/Jakarta
// lewat Intl API — bukan mengandalkan timezone default server.
function nowInJakarta() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[map.weekday], minutes: Number(map.hour) * 60 + Number(map.minute) };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isDepartmentOpen(dept) {
  if (!dept.schedule) return true; // IGD: selalu buka
  const { day, minutes } = nowInJakarta();
  return dept.schedule.some(
    (slot) => slot.days.includes(day) && minutes >= toMinutes(slot.start) && minutes < toMinutes(slot.end)
  );
}

export function scheduleText(dept) {
  if (!dept.schedule) return 'Buka 24 jam';
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return dept.schedule
    .map((slot) => `${slot.days.map((d) => dayNames[d]).join('/')} ${slot.start}–${slot.end}`)
    .join(', ');
}

// --- Privasi identitas pasien ---------------------------------------------
//
// Nama & NIK/BPJS dikumpulkan supaya sistem terasa seperti pendaftaran
// sungguhan, bukan sekadar cabut nomor. Tapi keduanya tidak pernah tampil
// utuh di layar publik (papan panggil, status tiket) — hanya nama yang
// disamarkan. NIK/BPJS penuh cuma tersimpan di Redis untuk keperluan
// pencarian oleh petugas, dan tidak pernah diikutsertakan di ticketToJSON.
export function maskName(name) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0]}.`;
}

export function maskId(id) {
  if (!id) return null;
  const digits = id.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

// Versi Go aslinya punya custom JSON marshaling supaya bentuk tiket di wire
// selalu eksplisit, bukan hasil default reflection. Prinsip yang sama
// dipertahankan di sini lewat satu fungsi tunggal — field apa yang keluar,
// dan yang sensitif (NIK penuh) memang sengaja tidak pernah dimasukkan.
export function ticketToJSON(ticket) {
  const dept = findDepartment(ticket.deptCode);
  return {
    id: ticket.id,
    number: formatTicketNumber(ticket.deptCode, ticket.seq),
    department: ticket.deptCode,
    departmentName: dept?.name ?? ticket.deptCode,
    patientName: maskName(ticket.patientName),
    patientIdMasked: maskId(ticket.patientId),
    status: ticket.status, // waiting | called | done
    priority: ticket.priority,
    issuedAt: ticket.issuedAt,
    calledAt: ticket.calledAt ?? null,
    counter: ticket.counter ?? null,
  };
}

export function parseTicket(raw) {
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
