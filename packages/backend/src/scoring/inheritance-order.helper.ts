import { GeographyChain } from './inheritance.types';

/**
 * Build the inheritance order for a geography.
 * Extracted from InheritanceService — pure function, no I/O.
 */
export function buildInheritanceOrder(
  chain: GeographyChain,
): Array<{ id: string; type: string }> {
  const order: Array<{ id: string; type: string }> = [];

  // Always start with the direct geography
  order.push({ id: chain.geographyId, type: chain.geographyType });

  // Add parents based on geography type
  switch (chain.geographyType) {
    case 'zip':
    case 'city':
      // ZIP/City → County → Metro → State → National
      if (chain.parentCountyFips) {
        order.push({ id: chain.parentCountyFips, type: 'county' });
      }
      if (chain.parentMetroCbsa) {
        order.push({ id: chain.parentMetroCbsa, type: 'metro' });
      }
      if (chain.parentStateFips) {
        order.push({ id: chain.parentStateFips, type: 'state' });
      }
      order.push({ id: 'national', type: 'national' });
      break;

    case 'county':
      // County → Metro → State → National
      if (chain.parentMetroCbsa) {
        order.push({ id: chain.parentMetroCbsa, type: 'metro' });
      }
      if (chain.parentStateFips) {
        order.push({ id: chain.parentStateFips, type: 'state' });
      }
      order.push({ id: 'national', type: 'national' });
      break;

    case 'metro':
      // Metro → State → National
      if (chain.parentStateFips) {
        order.push({ id: chain.parentStateFips, type: 'state' });
      }
      order.push({ id: 'national', type: 'national' });
      break;

    case 'state':
      // State → National
      order.push({ id: 'national', type: 'national' });
      break;

    case 'national':
      // National has no parents
      break;
  }

  return order;
}
