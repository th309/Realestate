import React from "react";
import type { SingleMarketVideoProps } from "../types";
import { GradeRevealFamilyLayout } from "./GradeRevealFamilyLayout";

/** 90s vertical format; grade-reveal structure with beats scaled 3×. */
export const RecruitmentAngleLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => <GradeRevealFamilyLayout videoProps={props} scale={3} />;
