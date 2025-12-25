// src/serviceWorkerRegistration.js
// Simple no-op registration to avoid attempts to register a missing service-worker.js
export function register() {
  // intentionally do nothing in production for now.
  // If you want to re-enable, implement conditional register logic:
  // if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`);
  console.log("serviceWorker registration is disabled (noop)");
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    }).catch(()=>{});
  }
}
