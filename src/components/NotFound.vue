<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for doesn't exist or has been moved.</p>
      <router-link to="/" class="back-button">Back to Home</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  text-align: center;
  padding: 2rem;
}

.not-found-content {
  background-color: var(--card);
  border-radius: var(--radius);
  padding: 3rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

h1 {
  font-size: 6rem;
  margin: 0;
  line-height: 1;
  color: var(--primary);
}

h2 {
  font-size: 2rem;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
  color: var(--foreground);
}

p {
  color: var(--muted);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.back-button {
  display: inline-block;
  background-color: var(--primary);
  color: var(--background);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.back-button:hover {
  background-color: var(--primary-hover);
}
</style>