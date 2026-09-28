// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner
// ═══════════════════════════════════════════════════════════
// The person this Warrior OS belongs to. Shown on the lock screen, in the
// About tab and wherever NEXUS addresses its owner. Leave a link empty to
// hide it.

/** Shape of the owner profile (plain strings, for components and helpers). */
export interface OwnerProfile {
  /** Full name, e.g. on the lock screen and creator card. */
  name: string;
  /** First name / nickname for friendly copy ("Keshav's system"). */
  shortName: string;
  /** Handle without the leading @. */
  handle: string;
  /** Profile links: leave empty to hide. */
  github: string;
  linkedin: string;
  website: string;
  /** Contact address (shown as a mailto: link). Leave empty to hide. */
  email: string;
  /** Public source code of this Warrior OS. Leave empty to hide. */
  repo: string;
  /** One-liner under the name. */
  tagline: string;
}

export const OWNER = {
  name: 'Keshav Upadhyay',
  shortName: 'Keshav',
  handle: 'techkeshav23',
  github: 'https://github.com/techkeshav23',
  linkedin: '',
  website: '',
  email: '',
  repo: 'https://github.com/techkeshav23/Warrior-OS',
  tagline: 'Builder of Warrior OS',
} as const satisfies OwnerProfile;

export type Owner = typeof OWNER;
