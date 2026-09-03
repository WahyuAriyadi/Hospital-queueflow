import { redis } from './_lib/redis.js';
import { DEPARTMENTS, parseTicket } from './_lib/ticket.js';
import { reapStale } from './_lib/actor.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { department } = req.query;
  const depts = department ? DEPARTMENTS.filter((d) => d.code === department) : DEPARTMENTS;

  const data = await Promise.all(
    depts.map(async (d) => {
      await reapStale(d.code);
      const [waiting, priorityWaiting, servingRaw] = await Promise.all([
        redis.llen(`queue:${d.code}:normal`),
        redis.llen(`queue:${d.code}:priority`),
        redis.get(`serving:${d.code}`),
      ]);
      return {
        code: d.code,
        name: d.name,
        waiting,
        priorityWaiting,
        nowServing: parseTicket(servingRaw),
      };
    })
  );

  res.status(200).json(department ? data[0] ?? null : data);
}
