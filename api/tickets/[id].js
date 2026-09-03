import { redis } from '../_lib/redis.js';
import { parseTicket, ticketToJSON } from '../_lib/ticket.js';
import { getQueuePosition } from '../_lib/actor.js';
import { getAvgServiceSeconds } from '../_lib/stats.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id } = req.query;
  const ticket = parseTicket(await redis.get(`ticket:${id}`));
  if (!ticket) {
    res.status(404).json({ error: 'Tiket tidak ditemukan' });
    return;
  }

  const base = ticketToJSON(ticket);

  if (ticket.status !== 'waiting') {
    res.status(200).json({ ...base, position: null, estimatedWaitMinutes: null });
    return;
  }

  const [position, avgServiceSeconds] = await Promise.all([
    getQueuePosition(ticket.deptCode, ticket.id),
    getAvgServiceSeconds(ticket.deptCode),
  ]);

  res.status(200).json({
    ...base,
    position, // 0 = giliran berikutnya
    estimatedWaitMinutes: position === null ? null : Math.round(((position * avgServiceSeconds) / 60) * 10) / 10,
  });
}
