const { createApp } = Vue;

createApp({
  data() {
    return {
      pin: '',
      authed: false,
      loading: false,
      error: '',
      data: null,
    };
  },
  mounted() {
    // sessionStorage sengaja dipakai (bukan localStorage) supaya PIN nggak
    // "nempel" lintas sesi browser — hilang begitu tab ditutup.
    const saved = sessionStorage.getItem('queueflow_admin_pin');
    if (saved) {
      this.pin = saved;
      this.login();
    }
  },
  methods: {
    async login() {
      this.loading = true;
      this.error = '';
      try {
        const res = await fetch('/api/admin/summary', {
          headers: { 'x-admin-pin': this.pin },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'PIN salah');
        }
        this.data = await res.json();
        this.authed = true;
        sessionStorage.setItem('queueflow_admin_pin', this.pin);
      } catch (e) {
        this.error = e.message;
        this.authed = false;
      } finally {
        this.loading = false;
      }
    },
    async load() {
      await this.login();
    },
  },
}).mount('#app');
