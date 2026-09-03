// Ini BUKAN sistem auth sungguhan — cuma PIN statis dibandingkan lewat
// header, cukup buat mencegah orang random yang kebetulan tebak URL admin,
// bukan buat menahan penyerang serius. Kalau proyek ini dipakai beneran
// buat data pasien sungguhan, ganti dengan auth session/JWT + HTTPS-only,
// bukan PIN polos di header. Ditulis jelas di README juga.
export function isAuthorizedAdmin(req) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false; // kalau env var belum diisi, admin dikunci total
  const given = req.headers['x-admin-pin'];
  return typeof given === 'string' && given === expected;
}
