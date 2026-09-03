const { createApp } = Vue;

const POLL_MS = 5000;

createApp({
  data() {
    return {
      ticket: null,
      notFound: false,
      id: new URLSearchParams(window.location.search).get('id'),
      timer: null,
    };
  },
  async mounted() {
    if (!this.id) {
      this.notFound = true;
      return;
    }
    await this.refresh();
    this.timer = setInterval(this.refresh, POLL_MS);
  },
  unmounted() {
    clearInterval(this.timer);
  },
  methods: {
    async refresh() {
      try {
        const res = await fetch(`/api/tickets/${this.id}`);
        if (res.status === 404) {
          this.notFound = true;
          clearInterval(this.timer);
          return;
        }
        if (!res.ok) return;
        this.ticket = await res.json();
        if (this.ticket.status === 'done') clearInterval(this.timer);
      } catch {
        // biarin, coba lagi di polling berikutnya
      }
    },
  },
}).mount('#app');
