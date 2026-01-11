/**
 * Load Geographic Data in Order with Hierarchy Building
 *
 * Loads: National -> States -> Metros -> Cities -> Counties -> Zip codes
 * After each level: Links to TIGER and builds hierarchy
 *
 * Refactored to use modular components from ./geo-data-loader/
 */

import { main } from './geo-data-loader/cli';

main().catch(console.error);
