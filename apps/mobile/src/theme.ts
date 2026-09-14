// "Horizon CPD" theme — violet/amber "sunrise" identity, matching the web
// rebrand (apps/web/tailwind.config.ts) and docs/horizon-cpd-mobile-concept.html.
// Use these in StyleSheet.create or inline style for any rgba/hex color
// NativeWind can't express (gradients, translucent glass surfaces).
//
// Scoping note: the concept design uses two deliberate modes (dark "sky" for
// identity/status moments, light "paper" for scanning/doing moments). This
// app keeps its existing dark-first architecture and applies the Horizon
// *palette* and *components* (ProgressRing, HorizonRule, badge grid, etc.)
// throughout rather than restructuring every screen into light mode — see
// the redesign commit message for the full rationale.

export const BG        = '#150a26';   // ink — main app background
export const BG_2       = '#1e1136';   // ink-2 — elevated dark surface
export const SURFACE   = 'rgba(255,255,255,0.06)';  // card / input surface
export const SURFACE2  = 'rgba(255,255,255,0.10)';  // slightly brighter surface
export const BORDER    = 'rgba(255,255,255,0.10)';  // default border
export const BORDER2   = 'rgba(255,255,255,0.18)';  // stronger border
export const BORDER_FOCUS = 'rgba(139,92,246,0.7)';  // focused input border (violet-500)

export const TEXT      = '#ffffff';
export const TEXT2     = 'rgba(255,255,255,0.65)';
export const TEXT3     = 'rgba(255,255,255,0.42)';
export const TEXT_FAINT = '#A29CB8'; // light-mode faint text (on PAPER surfaces)
export const TEXT_DIM   = '#726C87'; // light-mode dim text (on PAPER surfaces)

export const ACCENT    = '#7c3aed';  // violet-600 — primary
export const ACCENT_L  = '#c4b5fd';  // violet-300 — active tint on dark bg
export const ACCENT_BG = 'rgba(124,58,237,0.18)';

export const SUCCESS   = '#22c55e';
export const SUCCESS_BG = 'rgba(34,197,94,0.14)';
export const WARN      = '#f97316';  // amber-500 — warm/attention, not urgent
export const WARN_BG   = 'rgba(249,115,22,0.16)';
export const DANGER    = '#e11d48';  // rose — urgent (renewal countdown, errors)
export const DANGER_BG = 'rgba(225,29,72,0.16)';

export const HERO_BG   = '#150a26';

// ─── Horizon-specific tokens (for ProgressRing, HorizonRule, SkyHeader, etc.) ──

export const INK        = '#150a26';
export const INK_2      = '#1e1136';

export const VIOLET_300 = '#c4b5fd';
export const VIOLET_500 = '#8b5cf6';
export const VIOLET_600 = '#7c3aed';
export const VIOLET_700 = '#6d28d9';

export const AMBER_300  = '#fdba74';
export const AMBER_400  = '#fb923c';
export const AMBER_500  = '#f97316';
export const AMBER_600  = '#ea580c';

export const PAPER      = '#FAFAFC';
export const PAPER_2    = '#F3F0FA';
export const LINE       = '#E7E2F3';

export const VERIFIED      = '#0d9488';
export const VERIFIED_SOFT = '#EAFBF8';
export const WHATSAPP      = '#25D366'; // reserved ONLY for the WhatsApp affordance

export const ROSE = '#e11d48';
export const CYAN = '#0891b2';

// LinearGradient `colors` arrays — the recurring "horizon" device (violet -> amber)
export const GRADIENT_HORIZON: [string, string] = ['#8b5cf6', '#fb923c'];
export const GRADIENT_BUTTON: [string, string] = ['#7c3aed', '#8b5cf6'];
export const GRADIENT_SKY: [string, string, string] = ['#150a26', '#2e1065', '#1a0f2e'];
export const GRADIENT_LOGIN: [string, string, string] = ['#2e1065', '#6d28d9', '#ea580c'];
export const GRADIENT_BADGE_EARNED: [string, string] = ['#fb923c', '#ea580c'];
