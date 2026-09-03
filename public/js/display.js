const { createApp } = Vue;

const POLL_MS = 4000;

createApp({
  data() {
    return {
      queues: [],
      jamSekarang: '',
      timer: null,
      clockTimer: null,
    };
  },
  computed: {
    gridCols() {
      const n = this.queues.length;
      if (n <= 2) return 'grid-cols-1 sm:grid-cols-2';
      if (n <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    },
  },
  async mounted() {
    await this.refresh();
    this.timer = setInterval(this.refresh, POLL_MS);
    this.updateClock();
    this.clockTimer = setInterval(this.updateClock, 1000);
  },
  unmounted() {
    clearInterval(this.timer);
    clearInterval(this.clockTimer);
  },
  methods: {
    async refresh() {
      try {
        const res = await fetch('/api/queue-status');
        if (!res.ok) return;
        this.queues = await res.json();
      } catch {
        // diam-diam coba lagi di polling berikutnya — papan tidak boleh
        // menampilkan pesan error ke seisi ruang tunggu.
      }
    },
    updateClock() {
      this.jamSekarang = new Date().toLocaleTimeString('id-ID');
    },
  },
}).mount('#app');
