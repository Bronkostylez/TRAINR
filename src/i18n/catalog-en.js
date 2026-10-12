// Englischer Übungskatalog (Wörterbuch Satz → Satz), zusammengesetzt aus mehreren Teilen. Siehe catalog.js.
import { GOALIE } from './en-goalie.js';
import { C1 } from './catalog-en-1.js';
import { C2 } from './catalog-en-2.js';
import { C3 } from './catalog-en-3.js';
import { C4 } from './catalog-en-4.js';
import { C5 } from './catalog-en-5.js';
import { C6 } from './catalog-en-6.js';

export const CATALOG_EN = Object.assign({}, C1, C2, C3, C4, C5, C6, GOALIE);
