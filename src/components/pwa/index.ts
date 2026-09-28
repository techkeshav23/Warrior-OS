// ═══════════════════════════════════════════════════════════
// WARRIOR OS — PWA barrel
// Drop-in: <ServiceWorkerRegistrar /> (mount once at the page root).
// ═══════════════════════════════════════════════════════════

export { ServiceWorkerRegistrar, PWA_ACHIEVEMENT_ID } from './ServiceWorkerRegistrar';
export { usePwaInstallStore } from './usePwaInstallStore';
export type { BeforeInstallPromptEvent, InstallOutcome } from './usePwaInstallStore';
