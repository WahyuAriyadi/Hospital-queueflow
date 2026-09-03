import { redis } from './redis.js';
import { parseTicket } from './ticket.js';

// --- Klaim tiket berikutnya --------------------------------------------
//
// Versi Go: satu goroutine per loket, masing-masing satu-satunya pembaca
// dari channel-nya sendiri, jadi dua loket tidak akan pernah mengambil
// tiket yang sama — dijamin oleh compiler & race detector.
//
// Versi ini tidak punya proses yang hidup terus untuk memegang channel itu.
// Gantinya: Redis EVAL berjalan atomik (single-threaded) di sisi server
// Redis, jadi Lua script di bawah ini adalah "pemilik eksklusif" mailbox-nya
// yang baru — dua request call-next yang datang bersamaan tetap akan
// mengambil tiket yang berbeda, sama seperti jaminan channel di Go.
const CLAIM_NEXT_LUA = `
local emergencyKey = KEYS[1]
local normalKey = KEYS[2]
local id = redis.call('LPOP', emergencyKey)
if id then
  return {id, 'priority'}
end
id = redis.call('LPOP', normalKey)
if id then
  return {id, 'normal'}
end
return nil
`;

export async function enqueue(deptCode, ticketId, isPriority) {
  const key = isPriority ? `queue:${deptCode}:priority` : `queue:${deptCode}:normal`;
  await redis.rpush(key, ticketId);
}

export async function claimNext(deptCode) {
  const emergencyKey = `queue:${deptCode}:priority`;
  const normalKey = `queue:${deptCode}:normal`;
  const result = await redis.eval(CLAIM_NEXT_LUA, [emergencyKey, normalKey], []);
  if (!result) return null;
  const [ticketId, lane] = result;
  return { ticketId, lane };
}

// --- Self-heal tiket yang macet ------------------------------------------
//
// Versi Go: graceful shutdown menjamin tiket yang sedang diproses tidak
// hilang begitu saja saat server dimatikan — worker menyelesaikan channel-nya
// dulu sebelum proses benar-benar berhenti.
//
// Di serverless tidak ada proses untuk di-drain (setiap request memang
// sudah mulai & selesai sendiri-sendiri), jadi risiko yang tersisa berubah
// bentuk: bukan "server mati mendadak", tapi "loket memanggil tiket lalu
// tab browser petugas ditutup sebelum menekan Selesai". reapStale menutup
// celah itu: dipanggil di awal endpoint yang sering diakses (queue-status,
// call-next), ia mengecek apakah tiket yang sedang "called" sudah melewati
// batas waktu wajar tanpa dikonfirmasi, lalu mengembalikannya ke depan
// antrian prioritas supaya pasien tidak kehilangan gilirannya.
const STALE_MS = 5 * 60 * 1000; // 5 menit tanpa konfirmasi "Selesai"

export async function reapStale(deptCode) {
  const raw = await redis.get(`serving:${deptCode}`);
  const serving = parseTicket(raw);
  if (!serving || serving.status !== 'called' || !serving.calledAt) return;
  if (Date.now() - serving.calledAt < STALE_MS) return;

  const ticket = parseTicket(await redis.get(`ticket:${serving.id}`));
  if (!ticket || ticket.status !== 'called') return;

  ticket.status = 'waiting';
  ticket.calledAt = null;
  ticket.counter = null;
  await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));
  await redis.lpush(`queue:${deptCode}:priority`, ticket.id);
  await redis.del(`serving:${deptCode}`);
}
