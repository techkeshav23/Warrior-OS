import type { NextConfig } from "next";

// Security headers for every route. Deliberately no CSP: Code Lab's
// srcdoc preview inherits the page's CSP (user scripts, inline handlers)
// and Tone.js / three would need careful allow-lists. Framing is blocked
// with X-Frame-Options instead of CSP frame-ancestors for the same reason.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Microphone: NEXUS voice input / notes dictation. Geolocation: Weather.
    value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
