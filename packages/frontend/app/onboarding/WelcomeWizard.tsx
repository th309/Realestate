"use client";

import { useState, useCallback } from "react";
import { MarketPicker } from "./MarketPicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WelcomeWizardProps {
  onComplete: (preferences: WizardPreferences) => void;
  onSkip: () => void;
}

export interface WizardPreferences {
  user_type: string | null;
  investment_goal: string | null;
  experience_level: string | null;
  preferred_markets: Array<{
    geoLevel: string;
    geoId: string;
    name: string;
  }> | null;
}

// ---------------------------------------------------------------------------
// Option data
// ---------------------------------------------------------------------------

const USER_TYPES = [
  { value: "homebuyer", label: "First-time Homebuyer", icon: "\u{1F3E0}" },
  { value: "investor", label: "Real Estate Investor", icon: "\u{1F4C8}" },
  { value: "agent", label: "Agent / Broker", icon: "\u{1F91D}" },
  { value: "researcher", label: "Market Researcher", icon: "\u{1F50D}" },
];

const INVESTMENT_GOALS = [
  { value: "buy_home", label: "Buy a home to live in" },
  { value: "rental_income", label: "Rental income" },
  { value: "fix_flip", label: "Fix & flip" },
  { value: "appreciation", label: "Long-term appreciation" },
  { value: "exploring", label: "Just exploring" },
];

const EXPERIENCE_LEVELS = [
  {
    value: "new",
    label: "New to real estate",
    description: "Learning the basics",
  },
  {
    value: "intermediate",
    label: "Some experience",
    description: "Done a few deals or researched markets",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Active investor, agent, or analyst",
  },
];

const TOTAL_SCREENS = 4;

const SCREEN_CONTENT = [
  {
    title: "What describes you best?",
    subtitle: "We'll tailor your experience",
  },
  {
    title: "What's your main goal?",
    subtitle: "This helps us highlight the right data",
  },
  {
    title: "How experienced are you?",
    subtitle: "We'll adjust the level of detail",
  },
  {
    title: "Pick your target markets",
    subtitle: "Choose up to 3 markets to track",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WizardScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-medium text-on-surface">{title}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SelectionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-colors duration-200 ${
        selected
          ? "border-primary bg-primary/8"
          : "border-outline-variant bg-surface hover:border-outline"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WelcomeWizard({ onComplete, onSkip }: WelcomeWizardProps) {
  const [screen, setScreen] = useState(0);
  const [userType, setUserType] = useState<string | null>(null);
  const [investmentGoal, setInvestmentGoal] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<
    Array<{ geoLevel: string; geoId: string; name: string }>
  >([]);

  const progressPercent = ((screen + 1) / TOTAL_SCREENS) * 100;

  const canContinue =
    screen === 0
      ? userType !== null
      : screen === 1
        ? investmentGoal !== null
        : screen === 2
          ? experienceLevel !== null
          : true; // Market picker screen is always continuable (optional)

  const handleContinue = useCallback(() => {
    if (screen < TOTAL_SCREENS - 1) {
      setScreen((s) => s + 1);
    } else {
      onComplete({
        user_type: userType,
        investment_goal: investmentGoal,
        experience_level: experienceLevel,
        preferred_markets: selectedMarkets.length > 0 ? selectedMarkets : null,
      });
    }
  }, [
    screen,
    userType,
    investmentGoal,
    experienceLevel,
    selectedMarkets,
    onComplete,
  ]);

  const handleBack = useCallback(() => {
    if (screen > 0) setScreen((s) => s - 1);
  }, [screen]);

  const handleAddMarket = useCallback(
    (market: { geoLevel: string; geoId: string; name: string }) => {
      setSelectedMarkets((prev) => [...prev, market]);
    },
    [],
  );

  const handleRemoveMarket = useCallback((geoId: string) => {
    setSelectedMarkets((prev) => prev.filter((m) => m.geoId !== geoId));
  }, []);

  const { title, subtitle } = SCREEN_CONTENT[screen];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-lg mx-4 bg-surface-container-high rounded-[28px] shadow-lg overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-surface-container">
          <div
            className="h-full bg-primary transition-all duration-400 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content area */}
        <div className="p-8">
          <WizardScreen title={title} subtitle={subtitle}>
            {/* Screen 0: User type — 2x2 grid */}
            {screen === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {USER_TYPES.map((type) => (
                  <SelectionCard
                    key={type.value}
                    selected={userType === type.value}
                    onClick={() => setUserType(type.value)}
                  >
                    <div className="text-center py-2">
                      <span
                        className="text-3xl"
                        role="img"
                        aria-label={type.label}
                      >
                        {type.icon}
                      </span>
                      <p className="mt-2 text-sm font-medium text-on-surface">
                        {type.label}
                      </p>
                    </div>
                  </SelectionCard>
                ))}
              </div>
            )}

            {/* Screen 1: Investment goal — vertical list */}
            {screen === 1 && (
              <div className="space-y-2">
                {INVESTMENT_GOALS.map((goal) => (
                  <SelectionCard
                    key={goal.value}
                    selected={investmentGoal === goal.value}
                    onClick={() => setInvestmentGoal(goal.value)}
                  >
                    <p className="text-sm font-medium text-on-surface">
                      {goal.label}
                    </p>
                  </SelectionCard>
                ))}
              </div>
            )}

            {/* Screen 2: Experience level — vertical cards with descriptions */}
            {screen === 2 && (
              <div className="space-y-2">
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectionCard
                    key={level.value}
                    selected={experienceLevel === level.value}
                    onClick={() => setExperienceLevel(level.value)}
                  >
                    <p className="text-sm font-medium text-on-surface">
                      {level.label}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {level.description}
                    </p>
                  </SelectionCard>
                ))}
              </div>
            )}

            {/* Screen 3: Market picker */}
            {screen === 3 && (
              <MarketPicker
                selectedMarkets={selectedMarkets}
                onAdd={handleAddMarket}
                onRemove={handleRemoveMarket}
                maxSelections={3}
              />
            )}
          </WizardScreen>

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-full transition-colors duration-200"
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              {screen > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/8 rounded-full transition-colors duration-200"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleContinue}
                disabled={!canContinue}
                className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {screen === TOTAL_SCREENS - 1 ? "Finish" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
