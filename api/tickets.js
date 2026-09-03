import { randomUUID } from 'node:crypto';
import { redis } from './_lib/redis.js';
import { findDepartment, ticketToJSON } from './_lib/ticket.js';
import { enqueue } from './_lib/actor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { department } = req.body ?? {};
  const dept = findDepartment(department);
  if (!dept) {
    res.status(400).json({ error: 'Poli tidak dikenali' });
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
  };

  await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));
  await enqueue(dept.code, ticket.id, ticket.priority);

  res.status(201).json(ticketToJSON(ticket));
}
