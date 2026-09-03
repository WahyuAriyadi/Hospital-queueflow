const { createApp, nextTick } = Vue;

createApp({
  data() {
    return {
      step: 'identity', // identity | department | ticket
      patientName: '',
      patientId: '',
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
          body: JSON.stringify({
            department: code,
            patientName: this.patientName,
            patientId: this.patientId || null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal mengambil nomor antrian');
        }
        this.ticket = await res.json();
        this.step = 'ticket';
        await nextTick();
        this.renderQR();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.submitting = false;
      }
    },
    renderQR() {
      if (!this.$refs.qr || !window.QRCode) return;
      const url = `${window.location.origin}/status.html?id=${this.ticket.id}`;
      QRCode.toCanvas(this.$refs.qr, url, { width: 140, margin: 1 }, () => {});
    },
    reset() {
      this.ticket = null;
      this.patientName = '';
      this.patientId = '';
      this.step = 'identity';
      this.loadDepartments();
    },
  },
}).mount('#app');
