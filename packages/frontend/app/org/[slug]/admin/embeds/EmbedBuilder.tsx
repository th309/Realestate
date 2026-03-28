"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { StepIndicator } from "./StepIndicator";
import { StepChooseWidget } from "./steps/StepChooseWidget";
import { StepConfigure } from "./steps/StepConfigure";
import { StepGetCode } from "./steps/StepGetCode";
import {
  type WidgetType,
  WIDGET_TYPE_LABELS,
  RESPONSIVE_WIDGET_TYPES,
  type EmbedConfig,
} from "./embed-builder-types";
import {
  getDimensions,
  type Shape,
  type Size,
} from "./configurator/ShapeSizeSelector";
import {
  createOrgEmbedToken,
  updateOrgEmbedToken,
  revokeOrgEmbedToken,
} from "@/lib/data";

interface EmbedBuilderProps {
  orgSlug: string;
  onCreated: () => void;
}

const PRODUCTION_HOST = "https://www.propertyiq.app";

function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export function EmbedBuilder({ orgSlug, onCreated }: EmbedBuilderProps) {
  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [maxReached, setMaxReached] = useState<1 | 2 | 3>(1);

  // Step 1
  const [widgetType, setWidgetType] = useState<WidgetType | null>(null);

  // Step 2
  const [shape, setShape] = useState<Shape>("horizontal");
  const [size, setSize] = useState<Size>("medium");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Draft token
  const [draftTokenId, setDraftTokenId] = useState<string | null>(null);
  const [draftTokenValue, setDraftTokenValue] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);
  const draftTokenIdRef = useRef<string | null>(null);

  // Step 3
  const [embedName, setEmbedName] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  // Keep ref in sync for cleanup
  useEffect(() => {
    draftTokenIdRef.current = draftTokenId;
  }, [draftTokenId]);

  // Cleanup draft token on unmount
  useEffect(() => {
    return () => {
      if (draftTokenIdRef.current) {
        revokeOrgEmbedToken(orgSlug, draftTokenIdRef.current).catch(() => {});
      }
    };
  }, [orgSlug]);

  // Create draft token when entering Step 2
  const createDraftToken = useCallback(
    async (type: WidgetType) => {
      if (draftTokenId) {
        revokeOrgEmbedToken(orgSlug, draftTokenId).catch(() => {});
        setDraftTokenId(null);
        setDraftTokenValue(null);
      }

      setDraftCreating(true);
      try {
        const result = await createOrgEmbedToken(orgSlug, {
          name: "Draft",
          allowed_origins: ["*"],
          widget_types: [type],
          is_draft: true,
        });
        setDraftTokenId(result.id);
        setDraftTokenValue(result.token);
      } catch (err) {
        console.error("[EmbedBuilder] Failed to create draft token:", err);
      } finally {
        setDraftCreating(false);
      }
    },
    [orgSlug, draftTokenId],
  );

  // Finalize draft token (transition to Step 3)
  const finalizeDraftToken = useCallback(
    async (name: string) => {
      if (!draftTokenId || !embedUrl || !draftTokenValue) return;

      const origin = websiteUrl ? extractOrigin(websiteUrl) : "*";
      const showShapeSize = widgetType
        ? !RESPONSIVE_WIDGET_TYPES.includes(widgetType)
        : true;
      const dims = getDimensions(shape, size);
      const w = showShapeSize ? dims.w : 400;
      const h = showShapeSize ? dims.h : 300;

      const separator = embedUrl.includes("?") ? "&" : "?";
      const productionSrc = `${PRODUCTION_HOST}${embedUrl}${separator}token=${draftTokenValue}`;
      const snippet = `<iframe\n  src="${productionSrc}"\n  width="${w}"\n  height="${h}"\n  frameborder="0"\n  style="border-radius: 8px;"\n></iframe>`;

      const config: EmbedConfig = {
        widgetType: widgetType!,
        embedPath: embedUrl,
        geographyName: name.includes(" - ")
          ? name.split(" - ").slice(1).join(" - ")
          : "",
        width: w,
        height: h,
        snippet,
      };

      setFinalizing(true);
      try {
        await updateOrgEmbedToken(orgSlug, draftTokenId, {
          name,
          allowed_origins: [origin],
          is_draft: false,
          embed_config: config,
        });
        draftTokenIdRef.current = null;
      } catch (err) {
        console.error("[EmbedBuilder] Failed to finalize token:", err);
      } finally {
        setFinalizing(false);
      }
    },
    [
      draftTokenId,
      draftTokenValue,
      embedUrl,
      websiteUrl,
      widgetType,
      shape,
      size,
      orgSlug,
    ],
  );

  // Navigation
  const goToStep = useCallback((target: 1 | 2 | 3) => {
    setStep(target);
    setMaxReached((prev) => Math.max(prev, target) as 1 | 2 | 3);
  }, []);

  const handleNext = useCallback(async () => {
    if (step === 1 && widgetType) {
      await createDraftToken(widgetType);
      goToStep(2);
    } else if (step === 2 && embedUrl && websiteUrl) {
      const autoName =
        WIDGET_TYPE_LABELS[widgetType!] || widgetType || "Embed";
      setEmbedName(autoName);
      await finalizeDraftToken(autoName);
      goToStep(3);
      onCreated();
    }
  }, [
    step,
    widgetType,
    embedUrl,
    websiteUrl,
    createDraftToken,
    finalizeDraftToken,
    goToStep,
    onCreated,
  ]);

  const handleBack = useCallback(() => {
    if (step === 2) goToStep(1);
    else if (step === 3) goToStep(2);
  }, [step, goToStep]);

  const handleCreateAnother = useCallback(() => {
    setStep(1);
    setMaxReached(1);
    setWidgetType(null);
    setShape("horizontal");
    setSize("medium");
    setWebsiteUrl("");
    setEmbedUrl(null);
    setDraftTokenId(null);
    setDraftTokenValue(null);
    setEmbedName("");
  }, []);

  const handleDone = useCallback(() => {
    handleCreateAnother();
    document
      .getElementById("existing-embeds")
      ?.scrollIntoView({ behavior: "smooth" });
  }, [handleCreateAnother]);

  const handleNameChange = useCallback(
    async (newName: string) => {
      setEmbedName(newName);
      if (draftTokenId) {
        updateOrgEmbedToken(orgSlug, draftTokenId, { name: newName }).catch(
          () => {},
        );
      }
    },
    [draftTokenId, orgSlug],
  );

  // Derive states
  const canGoNext =
    (step === 1 && widgetType !== null) ||
    (step === 2 &&
      embedUrl !== null &&
      websiteUrl !== "" &&
      /^https?:\/\/.+/.test(websiteUrl));

  const showShapeSize = widgetType
    ? !RESPONSIVE_WIDGET_TYPES.includes(widgetType)
    : true;
  const dims = getDimensions(shape, size);

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-on-surface">
          Embed Builder
        </h2>
        <p className="text-sm text-on-surface-variant">
          Add PropertyIQ data to your website in 3 steps
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        currentStep={step}
        onStepClick={goToStep}
        maxReachedStep={maxReached}
      />

      {/* Step Content */}
      <div className="min-h-[300px]">
        {step === 1 && (
          <StepChooseWidget
            selectedType={widgetType}
            onSelect={setWidgetType}
          />
        )}

        {step === 2 && widgetType && (
          <StepConfigure
            widgetType={widgetType}
            token={draftTokenValue || ""}
            shape={shape}
            size={size}
            onShapeChange={setShape}
            onSizeChange={setSize}
            websiteUrl={websiteUrl}
            onWebsiteUrlChange={setWebsiteUrl}
            onEmbedUrlChange={setEmbedUrl}
            embedUrl={embedUrl}
          />
        )}

        {step === 3 && embedUrl && draftTokenValue && (
          <StepGetCode
            embedUrl={embedUrl}
            token={draftTokenValue}
            width={showShapeSize ? dims.w : 400}
            height={showShapeSize ? dims.h : 300}
            name={embedName}
            onNameChange={handleNameChange}
            onCreateAnother={handleCreateAnother}
            onDone={handleDone}
          />
        )}
      </div>

      {/* Navigation (not shown on Step 3) */}
      {step !== 3 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
              step === 1
                ? "text-on-surface-variant/40 cursor-default"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext || draftCreating || finalizing}
            className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
              canGoNext && !draftCreating && !finalizing
                ? "bg-primary text-on-primary hover:bg-primary/90"
                : "bg-primary/30 text-on-primary/50 cursor-not-allowed"
            }`}
          >
            {draftCreating || finalizing ? "Loading..." : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
