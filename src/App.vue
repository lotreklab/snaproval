<script setup>
import ThemeSwitch from './components/ThemeSwitch.vue'
</script>

<template>
  <div class="app-container">
    <header>
      <div class="logo-container">
        <h1>👩‍⚕️ Snaproval <span class="small">by Lotrek</span></h1>
      </div>
      <nav class="main-nav">
        <router-link to="/" :class="{ active: $route.path === '/' }">Home</router-link>
        <router-link to="/results" :class="{ active: $route.path === '/results' }">Jobs</router-link>
        <ThemeSwitch />
      </nav>
    </header>
    <main>
      <router-view />
    </main>
    <footer>
      <p>&copy; {{ new Date().getFullYear() }} Snaproval - Built with 💕 by Lotrek</p>
    </footer>
  </div>
</template>

<style>
/* App-specific styles - global styles are in style.css */
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background-color: var(--card);
  color: var(--foreground);
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    gap: 1rem;
  }
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.small {
  font-size: 0.8rem;
  color: var(--muted);
}

.main-nav {
  display: flex;
  gap: 1.5rem;
}

.main-nav a {
  color: var(--foreground);
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  transition: all 0.2s ease;
}

.main-nav a:hover {
  background-color: var(--card-hover);
}

.main-nav a.active {
  background-color: var(--card-hover);
  border: 1px solid var(--border);
}

.logo {
  height: 2em;
  filter: invert(1); /* Make the Vue logo white */
}

main {
  flex: 1;
  max-width: 1200px;
  width: 100vw;
  margin: 0 auto;
}

footer {
  background-color: var(--card);
  color: var(--muted);
  text-align: center;
  padding: 1rem;
  margin-top: auto;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
}
</style>
