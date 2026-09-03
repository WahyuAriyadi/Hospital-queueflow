import { redis } from './redis.js';

// Tanggal lokal Jakarta buat key harian — bukan tanggal UTC server, supaya
// pergantian hari terjadi jam 00:00 WIB, bukan jam 7 pagi WIB (00:00 UTC).
export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); // YYYY-MM-DD
}

export async function bumpIssued(deptCode) {
  await redis.incr(`stats:${deptCode}:${todayJakarta()}:issued`);
}

export async function bumpCompleted(deptCode) {
  await redis.incr(`stats:${deptCode}:${todayJakarta()}:completed`);
}

// Rata-rata waktu layanan dihitung pakai exponential moving average, bukan
// rata-rata penuh dari semua tiket historis — supaya poli yang tiba-tiba
// lebih cepat/lambat hari ini langsung tercermin di estimasi, tanpa perlu
// nyimpen daftar durasi mentah.
const EMA_ALPHA = 0.3;
const DEFAULT_SERVICE_SECONDS = 300; // asumsi awal 5 menit sebelum ada data

export async function updateAvgService(deptCode, durationMs) {
  const key = `avgservice:${deptCode}`;
  const prev = await redis.get(key);
  const durationSec = Math.max(30, Math.round(durationMs / 1000)); // batas bawah wajar
  const next = prev ? Math.round(Number(prev) * (1 - EMA_ALPHA) + durationSec * EMA_ALPHA) : durationSec;
  await redis.set(key, next);
}

export async function getAvgServiceSeconds(deptCode) {
  const val = await redis.get(`avgservice:${deptCode}`);
  return val ? Number(val) : DEFAULT_SERVICE_SECONDS;
}

export async function getTodayStats(deptCode) {
  const date = todayJakarta();
  const [issued, completed, avgServiceSeconds] = await Promise.all([
    redis.get(`stats:${deptCode}:${date}:issued`),
    redis.get(`stats:${deptCode}:${date}:completed`),
    getAvgServiceSeconds(deptCode),
  ]);
  return {
    date,
    issued: Number(issued ?? 0),
    completed: Number(completed ?? 0),
    avgServiceMinutes: Math.round((avgServiceSeconds / 60) * 10) / 10,
  };
}
