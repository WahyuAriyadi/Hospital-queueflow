import { DEPARTMENTS } from '../_lib/ticket.js';
import { getTodayStats } from '../_lib/stats.js';
import { redis } from '../_lib/redis.js';
import { isAuthorizedAdmin } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorizedAdmin(req)) {
    res.status(401).json({ error: 'PIN admin salah atau belum diatur' });
    return;
  }

  const data = await Promise.all(
    DEPARTMENTS.map(async (d) => {
      const [stats, waiting, priorityWaiting] = await Promise.all([
        getTodayStats(d.code),
        redis.llen(`queue:${d.code}:normal`),
        redis.llen(`queue:${d.code}:priority`),
      ]);
      return { code: d.code, name: d.name, ...stats, currentlyWaiting: waiting + priorityWaiting };
    })
  );

  res.status(200).json({ generatedAt: Date.now(), departments: data });
}
