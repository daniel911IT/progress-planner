import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch((error: unknown) => {
      console.error('Progress Planner Service Worker konnte nicht registriert werden:', error);
    });
  });
}
