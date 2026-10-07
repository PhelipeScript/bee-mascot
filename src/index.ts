/**
 * Entry point da biblioteca — import { createBeeMascot } from '@sistema/bee-mascot'
 *
 * Zero dependências de runtime. Sprites embutidos como string (?raw).
 */

export { createBeeMascot } from './core/bee';
export type { BeeMascot, BeeOptions, BeeState, BeeEvents, EnergyProfile, Quality, Theme, BeePoint, BeeTarget, SetStateOptions, CelebrationOptions } from './types';

export { createFavicon } from './integrations/favicon';
export type { FaviconController, FaviconOptions } from './integrations/favicon';

export { createBeeLoader } from './integrations/loader';
export type { BeeLoader, LoaderOptions } from './integrations/loader';

export { createGuide } from './integrations/guide';
export type { BeeGuide, GuideStep } from './integrations/guide';

export { attachReactions } from './integrations/reactions';
export type { ReactionOptions } from './integrations/reactions';

export { attachEasterEgg } from './integrations/easterEgg';
export type { EasterEggOptions } from './integrations/easterEgg';

export { prefersReducedMotion, onReducedMotionChange, createAnnouncer } from './integrations/a11y';

export { prepareSprites, frameToStandaloneSvg, DEFAULT_SPRITES } from './sprites';
export type { PreparedSprites, RawSprite } from './sprites';
