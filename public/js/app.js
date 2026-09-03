const { createApp } = Vue;

createApp({
  data() {
    return {
      departments: [],
      loading: true,
      submitting: false,
      error: '',
      ticket: null,
    };
  },
  async mounted() {
    await this.loadDepartments();
  },
  methods: {
    async loadDepartments() {
      this.loading = true;
      try {
        const res = await fetch('/api/departments');
        if (!res.ok) throw new Error('Gagal memuat daftar poli');
        this.departments = await res.json();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async ambilTiket(code) {
      this.submitting = true;
      this.error = '';
      try {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: code }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal mengambil nomor antrian');
        }
        this.ticket = await res.json();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.submitting = false;
      }
    },
    reset() {
      this.ticket = null;
      this.loadDepartments();
    },
    waktu(ms) {
      return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    },
  },
}).mount('#app');
