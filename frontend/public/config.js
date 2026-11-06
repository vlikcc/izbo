// Development default. In the production image nginx answers /config.js itself with the container's
// APP_API_URL (see nginx.conf.template); an empty value falls back to VITE_API_URL.
window.__APP_CONFIG__ = {};
