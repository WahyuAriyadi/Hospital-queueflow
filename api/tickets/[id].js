import { redis } from '../_lib/redis.js';
import { parseTicket, ticketToJSON } from '../_lib/ticket.js';

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

  res.status(200).json(ticketToJSON(ticket));
}
