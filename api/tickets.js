import { randomUUID } from 'node:crypto';
import { redis } from './_lib/redis.js';
import { findDepartment, isDepartmentOpen, scheduleText, ticketToJSON } from './_lib/ticket.js';
import { enqueue } from './_lib/actor.js';
import { bumpIssued } from './_lib/stats.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { department, patientName, patientId } = req.body ?? {};
  const dept = findDepartment(department);
  if (!dept) {
    res.status(400).json({ error: 'Poli tidak dikenali' });
    return;
  }
  if (!patientName || !patientName.trim()) {
    res.status(400).json({ error: 'Nama pasien wajib diisi' });
    return;
  }
  if (!isDepartmentOpen(dept)) {
    res.status(409).json({ error: `${dept.name} sedang tutup. Jadwal praktik: ${scheduleText(dept)}` });
    return;
  }

  const seq = await redis.incr(`seq:${dept.code}`);
  const ticket = {
    id: randomUUID(),
    deptCode: dept.code,
    seq,
    status: 'waiting',
    priority: dept.priority, // ditentukan server dari data poli, bukan input pasien
    issuedAt: Date.now(),
    calledAt: null,
    counter: null,
    patientName: patientName.trim(),
    patientId: patientId ? String(patientId).trim() : null, // opsional — NIK/BPJS, tidak pernah dikembalikan utuh
  };

  await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));
  await enqueue(dept.code, ticket.id, ticket.priority);
  await bumpIssued(dept.code);

  res.status(201).json(ticketToJSON(ticket));
}
