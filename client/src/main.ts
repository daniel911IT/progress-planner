import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.error('Progress Planner Service Worker konnte nicht registriert werden:', error);
    });
  });
}
