import React from "react";
import type { SingleMarketVideoProps } from "../types";
import { GradeRevealFamilyLayout } from "./GradeRevealFamilyLayout";

/** 30s flagship Reel: the score-reveal structure at its base pacing. */
export const GradeRevealLayout: React.FC<SingleMarketVideoProps> = (props) => (
  <GradeRevealFamilyLayout videoProps={props} scale={1} />
);
