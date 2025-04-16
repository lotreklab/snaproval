<script setup>
import { ref, onMounted, watch } from 'vue';

const isDarkTheme = ref(true);

// Initialize theme from localStorage or system preference
onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDarkTheme.value = savedTheme === 'dark';
  } else {
    // Check system preference if no saved theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDarkTheme.value = prefersDark;
  }
  applyTheme();
});

// Watch for changes and update localStorage and apply theme
watch(isDarkTheme, () => {
  localStorage.setItem('theme', isDarkTheme.value ? 'dark' : 'light');
  applyTheme();
});

// Apply the theme by setting the class on the document element
const applyTheme = () => {
  if (isDarkTheme.value) {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
  } else {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
  }
};

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
};
</script>

<template>
  <button @click="toggleTheme" class="theme-switch" aria-label="Toggle theme">
    <span class="icon" v-if="isDarkTheme">
      <!-- Sun icon for dark mode (switch to light) -->
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    </span>
    <span class="icon" v-else>
      <!-- Moon icon for light mode (switch to dark) -->
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </span>
  </button>
</template>

<style scoped>
.theme-switch {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 50%;
  color: var(--foreground);
  transition: all 0.2s ease;
  width: 44px;
}

.theme-switch:hover {
  background-color: var(--card-hover);
}

.theme-switch:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>