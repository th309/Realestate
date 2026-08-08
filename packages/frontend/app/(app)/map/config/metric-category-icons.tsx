/**
 * Metric Category Icons
 *
 * Icons for the map sidebar's metric categories. These were hand-rolled
 * Material Symbols SVG paths; they are now `lucide-react`, which is the set
 * the rest of the app draws from — the analyzer's jump bar, the app bar, the
 * screener's preset chips. A second, bespoke icon vocabulary on one surface is
 * part of what made the map read as a different product.
 *
 * The exported names and the `() => JSX` call signature are unchanged, so
 * every call site (`<SpeedIcon />`) keeps working untouched.
 */
import {
  Building2,
  HardHat,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

/** Matches the 20px box the Material glyphs rendered at. */
const SIZE = "size-5";

/** Economic Context / Local Economy */
export const EconomicIcon = () => <Building2 className={SIZE} />;

/** Competition / Speed */
export const SpeedIcon = () => <Zap className={SIZE} />;

/** Cash flow / rent affordability */
export const WalletIcon = () => <Wallet className={SIZE} />;

/** Growth / appreciation */
export const GrowthIcon = () => <TrendingUp className={SIZE} />;

/** Risk / stability */
export const ShieldIcon = () => <ShieldCheck className={SIZE} />;

/** New Construction */
export const ConstructionIcon = () => <HardHat className={SIZE} />;
