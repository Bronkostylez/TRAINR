// Englisches Wörterbuch (Schlüssel = deutscher Text). Aufbau siehe index.js. Teile liegen in en-*.js.
import { CORE } from './en-core.js';
import { HELP } from './en-help.js';
import { TODAY } from './en-today.js';
import { ONBOARDING } from './en-onboarding.js';
import { LIBRARY } from './en-library.js';
import { DETAIL } from './en-detail.js';
import { PLAN } from './en-plan.js';
import { MORE } from './en-more.js';
import { CALENDAR } from './en-calendar.js';
import { EXPORT } from './en-export.js';
import { SCENES } from './en-scenes.js';
import { MISC } from './en-misc.js';
import { SOURCE_SUPPORTS_EN } from './catalog-en-tags.js';

// Spätere Teile überschreiben frühere bei gleichem Schlüssel; Spezielles zuletzt.
export const EN = Object.assign({}, CORE, HELP, ONBOARDING, TODAY, LIBRARY, DETAIL, PLAN, MORE, CALENDAR, EXPORT, SCENES, SOURCE_SUPPORTS_EN, MISC);
