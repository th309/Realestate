"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, ChevronRight } from "lucide-react";

interface CustomResearchPromoCardProps {
  onOpen: () => void;
}

// Right-column promo that links the report builder to the AI research agent.
export function CustomResearchPromoCard({
  onOpen,
}: CustomResearchPromoCardProps) {
  return (
    <motion.button
      onClick={onOpen}
      className="
              group relative overflow-hidden
              w-full text-left rounded-3xl p-6 lg:p-8
              flex flex-col
              transition-all duration-500 ease-out
              bg-gradient-to-br from-secondary/5 via-secondary/10 to-secondary/5
              hover:from-secondary/10 hover:via-secondary/15 hover:to-secondary/10
              border border-outline-variant/30 hover:border-outline-variant/60
              hover:shadow-xl hover:shadow-black/5
              self-stretch
            "
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 transition-opacity duration-500 group-hover:opacity-50 bg-secondary" />
      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-secondary/15 text-secondary">
        <FileText className="w-7 h-7" />
      </div>
      <div className="relative flex-1">
        <h2 className="text-xl lg:text-2xl font-semibold text-on-surface mb-2 tracking-tight">
          Custom Research
        </h2>
        <p className="text-on-surface-variant text-sm lg:text-base leading-relaxed">
          Ask any real estate question. Get an AI-powered research brief backed
          by PropertyIQ data.
        </p>
      </div>
      <div className="relative flex items-center justify-between mt-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-secondary/10 text-secondary">
          <Sparkles className="w-4 h-4" />
          AI Research Agent
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-secondary text-on-secondary">
          <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </motion.button>
  );
}
