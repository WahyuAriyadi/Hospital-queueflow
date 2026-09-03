import { redis } from './redis.js';
import { parseTicket } from './ticket.js';

// --- Klaim tiket berikutnya --------------------------------------------
//
// Versi Go: satu goroutine per loket, masing-masing satu-satunya pembaca
// dari channel-nya sendiri, jadi dua loket tidak akan pernah mengambil
// tiket yang sama — dijamin oleh compiler & race detector.
//
// Versi ini tidak punya proses yang hidup terus untuk memegang channel itu.
// Gantinya: Redis EVAL berjalan atomik (single-threaded) di sisi Redis,
// jadi Lua script di bawah ini adalah "pemilik eksklusif" mailbox-nya yang
// baru — dua loket yang manggil bersamaan tetap akan mengambil tiket yang
// berbeda, sama seperti jaminan channel di Go. Ini juga yang membuat
// dukungan multi-loket per poli aman: berapa pun loket yang manggil
// bersamaan untuk poli yang sama, tidak ada tiket yang terpanggil dobel.
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

// --- Posisi & estimasi tunggu ---------------------------------------------
//
// Posisi dihitung sebagai "berapa orang di depanmu", dengan jalur prioritas
// selalu dianggap lebih depan daripada jalur reguler (sesuai urutan yang
// benar-benar dipakai claimNext). LPOS adalah command Redis native untuk
// mencari index elemen dalam list — dibungkus lewat EVAL supaya konsisten
// dengan pola di file ini, dan supaya tidak bergantung pada SDK client
// membungkus LPOS secara eksplisit.
const POSITION_LUA = `
local pPos = redis.call('LPOS', KEYS[1], ARGV[1])
if pPos then
  return {pPos, 'priority'}
end
local nPos = redis.call('LPOS', KEYS[2], ARGV[1])
if nPos then
  local pLen = redis.call('LLEN', KEYS[1])
  return {pLen + nPos, 'normal'}
end
return nil
`;

export async function getQueuePosition(deptCode, ticketId) {
  const result = await redis.eval(
    POSITION_LUA,
    [`queue:${deptCode}:priority`, `queue:${deptCode}:normal`],
    [ticketId]
  );
  if (!result) return null;
  const [position] = result;
  return position; // 0-indexed jumlah orang di depan
}

// --- Multi-loket per poli ---------------------------------------------
//
// Satu poli sekarang bisa dilayani beberapa loket sekaligus. Tiap loket
// punya key servingnya sendiri (`serving:{dept}:{counter}`) supaya dua
// loket di poli yang sama tidak saling menimpa status "sedang dilayani"
// satu sama lain. `activeCounters:{dept}` cuma daftar loket mana saja yang
// pernah aktif hari ini, dipakai papan panggil untuk tahu loket apa saja
// yang perlu ditampilkan.
export async function registerCounter(deptCode, counter) {
  await redis.sadd(`activeCounters:${deptCode}`, counter);
}

export async function getServingByCounter(deptCode) {
  const counters = await redis.smembers(`activeCounters:${deptCode}`);
  if (!counters || counters.length === 0) return [];

  const rawList = await Promise.all(counters.map((c) => redis.get(`serving:${deptCode}:${c}`)));
  return counters
    .map((counter, i) => ({ counter, ticket: parseTicket(rawList[i]) }))
    .filter((entry) => entry.ticket !== null);
}

// --- Self-heal tiket yang macet ------------------------------------------
//
// Versi Go: graceful shutdown menjamin tiket yang sedang diproses tidak
// hilang begitu saja saat server dimatikan — worker menyelesaikan channel-nya
// dulu sebelum proses benar-benar berhenti.
//
// Di serverless tidak ada proses untuk di-drain, jadi risiko yang tersisa
// berubah bentuk: loket memanggil tiket lalu tab browser petugas ditutup
// sebelum menekan Selesai. reapStaleAll menutup celah itu untuk *semua*
// loket aktif di satu poli sekaligus — dipanggil di awal endpoint yang
// sering diakses (queue-status, call-next).
const STALE_MS = 5 * 60 * 1000; // 5 menit tanpa konfirmasi "Selesai"

export async function reapStaleAll(deptCode) {
  const entries = await getServingByCounter(deptCode);
  await Promise.all(
    entries.map(async ({ counter, ticket: serving }) => {
      if (serving.status !== 'called' || !serving.calledAt) return;
      if (Date.now() - serving.calledAt < STALE_MS) return;

      const ticket = parseTicket(await redis.get(`ticket:${serving.id}`));
      if (!ticket || ticket.status !== 'called') return;

      ticket.status = 'waiting';
      ticket.calledAt = null;
      ticket.counter = null;
      await redis.set(`ticket:${ticket.id}`, JSON.stringify(ticket));
      await redis.lpush(`queue:${deptCode}:priority`, ticket.id);
      await redis.del(`serving:${deptCode}:${counter}`);
    })
  );
}
