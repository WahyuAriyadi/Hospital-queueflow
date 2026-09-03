import { redis } from './_lib/redis.js';
import { findDepartment, parseTicket, ticketToJSON } from './_lib/ticket.js';
import { claimNext, reapStale } from './_lib/actor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { department, counter } = req.body ?? {};
  const dept = findDepartment(department);
  if (!dept) {
    res.status(400).json({ error: 'Poli tidak dikenali' });
    return;
  }

  await reapStale(dept.code);

  const claim = await claimNext(dept.code);
  if (!claim) {
    res.status(200).json({ ticket: null, message: 'Antrian kosong' });
    return;
  }

  const ticket = parseTicket(await redis.get(`ticket:${claim.ticketId}`));
  ticket.status = 'called';
  ticket.calledAt = Date.now();
  ticket.counter = counter || null;

  await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));
  await redis.set(`serving:${dept.code}`, JSON.stringify(ticketToJSON(ticket)));

  res.status(200).json(ticketToJSON(ticket));
}
