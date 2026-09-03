// Daftar poli. `priority: true` berarti setiap tiket dari poli ini otomatis
// masuk jalur prioritas (IGD) — bukan sesuatu yang bisa dicentang pasien
// sendiri, supaya jalur darurat tidak bisa disalahgunakan untuk menyerobot.
export const DEPARTMENTS = [
  { code: 'IGD', name: 'IGD — Gawat Darurat', priority: true },
  { code: 'UMM', name: 'Poli Umum', priority: false },
  { code: 'GGI', name: 'Poli Gigi', priority: false },
  { code: 'ANK', name: 'Poli Anak', priority: false },
  { code: 'MTA', name: 'Poli Mata', priority: false },
  { code: 'JTG', name: 'Poli Jantung', priority: false },
];

export function findDepartment(code) {
  return DEPARTMENTS.find((d) => d.code === code) ?? null;
}

export function formatTicketNumber(deptCode, seq) {
  return `${deptCode}-${String(seq).padStart(3, '0')}`;
}

// Versi Go aslinya punya custom JSON marshaling supaya bentuk tiket di wire
// selalu eksplisit, bukan hasil default reflection. Di sini prinsip yang sama
// dipertahankan lewat satu fungsi tunggal: field apa yang keluar, urutannya,
// dan bagaimana nomor tiket ditampilkan (dept + urutan berpadding) selalu
// lewat sini — tidak pernah res.json(ticketMentah) langsung dari endpoint manapun.
export function ticketToJSON(ticket) {
  const dept = findDepartment(ticket.deptCode);
  return {
    id: ticket.id,
    number: formatTicketNumber(ticket.deptCode, ticket.seq),
    department: ticket.deptCode,
    departmentName: dept?.name ?? ticket.deptCode,
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
