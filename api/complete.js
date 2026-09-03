import { redis } from './_lib/redis.js';
import { findDepartment, parseTicket, ticketToJSON } from './_lib/ticket.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { ticketId, department } = req.body ?? {};
  const ticket = parseTicket(await redis.get(`ticket:${ticketId}`));
  if (!ticket) {
    res.status(404).json({ error: 'Tiket tidak ditemukan' });
    return;
  }

  ticket.status = 'done';
  await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));

  const dept = findDepartment(department);
  if (dept) await redis.del(`serving:${dept.code}`);

  res.status(200).json(ticketToJSON(ticket));
}
