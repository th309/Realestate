import React from "react";
import type { SingleMarketVideoProps } from "../types";
import { GradeRevealFamilyLayout } from "./GradeRevealFamilyLayout";

/** 75s vertical format; grade-reveal structure with beats scaled 2.5×. */
export const BrokerageMarketShareLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => <GradeRevealFamilyLayout videoProps={props} scale={2.5} />;
