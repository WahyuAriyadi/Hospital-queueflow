const { createApp } = Vue;

const POLL_MS = 4000;

createApp({
  data() {
    return {
      queues: [],
      jamSekarang: '',
      timer: null,
      clockTimer: null,
      voiceOn: false,
      announced: new Set(), // `${ticketId}:${calledAt}` yang sudah diumumkan, biar nggak diulang tiap poll
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
    toggleVoice() {
      // speechSynthesis butuh user gesture buat aktif pertama kali di
      // kebanyakan browser — makanya ini tombol, bukan otomatis nyala.
      this.voiceOn = !this.voiceOn;
      if (this.voiceOn) {
        const test = new SpeechSynthesisUtterance('Suara panggilan aktif');
        test.lang = 'id-ID';
        window.speechSynthesis.speak(test);
      } else {
        window.speechSynthesis.cancel();
      }
    },
    announce(ticket) {
      const key = `${ticket.id}:${ticket.calledAt}`;
      if (this.announced.has(key)) return;
      this.announced.add(key);
      if (!this.voiceOn) return;
      const text = `Nomor antrian ${ticket.number.split('').join(' ')}, silakan menuju loket ${ticket.counter}`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'id-ID';
      window.speechSynthesis.speak(utter);
    },
    async refresh() {
      try {
        const res = await fetch('/api/queue-status');
        if (!res.ok) return;
        this.queues = await res.json();
        for (const d of this.queues) {
          for (const s of d.serving) {
            if (s.ticket.status === 'called') this.announce(s.ticket);
          }
        }
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
