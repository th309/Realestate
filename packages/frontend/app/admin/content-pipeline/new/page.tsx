"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { ConfirmStep } from "./confirm-step";

export default function NewRunPage() {
  const [step, setStep] = useState<"format" | "market" | "confirm">("format");
  const [format, setFormat] = useState<string>("");
  const [market, setMarket] = useState<string>("");
  const router = useRouter();

  return (
    <div>
      {step === "format" && (
        <FormatStep
          onPick={(f) => {
            setFormat(f);
            setStep("market");
          }}
        />
      )}
      {step === "market" && (
        <MarketStep
          onBack={() => setStep("format")}
          onPick={(m) => {
            setMarket(m);
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <ConfirmStep
          format={format}
          market={market}
          onBack={() => setStep("market")}
          onCreated={(id) => router.push(`/admin/content-pipeline/runs/${id}`)}
        />
      )}
    </div>
  );
}
