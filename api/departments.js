import { redis } from './_lib/redis.js';
import { DEPARTMENTS, isDepartmentOpen, scheduleText } from './_lib/ticket.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const data = await Promise.all(
    DEPARTMENTS.map(async (d) => {
      const [waiting, priorityWaiting] = await Promise.all([
        redis.llen(`queue:${d.code}:normal`),
        redis.llen(`queue:${d.code}:priority`),
      ]);
      return {
        code: d.code,
        name: d.name,
        priority: d.priority,
        waiting,
        priorityWaiting,
        open: isDepartmentOpen(d),
        scheduleText: scheduleText(d),
      };
    })
  );

  res.status(200).json(data);
}
