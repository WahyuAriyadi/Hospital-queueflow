const { createApp } = Vue;

const POLL_MS = 5000;

createApp({
  data() {
    return {
      departments: [],
      dept: '',
      counter: '',
      setup: false,
      current: null,
      busy: false,
      notice: '',
      otherCounters: [],
      timer: null,
    };
  },
  computed: {
    deptName() {
      return this.departments.find((d) => d.code === this.dept)?.name ?? this.dept;
    },
  },
  async mounted() {
    const res = await fetch('/api/departments');
    if (res.ok) this.departments = await res.json();
  },
  watch: {
    setup(active) {
      clearInterval(this.timer);
      if (active) {
        this.refreshOtherCounters();
        this.timer = setInterval(this.refreshOtherCounters, POLL_MS);
      }
    },
  },
  unmounted() {
    clearInterval(this.timer);
  },
  methods: {
    async refreshOtherCounters() {
      try {
        const res = await fetch(`/api/queue-status?department=${this.dept}`);
        if (!res.ok) return;
        const data = await res.json();
        this.otherCounters = (data?.serving ?? []).filter((s) => s.counter !== this.counter);
      } catch {
        // biarin, coba lagi di polling berikutnya
      }
    },
    async panggilBerikutnya() {
      this.busy = true;
      this.notice = '';
      try {
        const res = await fetch('/api/call-next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: this.dept, counter: this.counter }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Gagal memanggil pasien');
        if (!body.ticket && body.message) {
          this.notice = body.message;
        } else {
          this.current = body;
        }
      } catch (e) {
        this.notice = e.message;
      } finally {
        this.busy = false;
      }
    },
    async selesai() {
      if (!this.current) return;
      this.busy = true;
      try {
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: this.current.id, department: this.dept, counter: this.counter }),
        });
        if (!res.ok) throw new Error('Gagal menandai selesai');
        this.current = null;
        this.notice = 'Tiket ditandai selesai.';
      } catch (e) {
        this.notice = e.message;
      } finally {
        this.busy = false;
      }
    },
  },
}).mount('#app');
