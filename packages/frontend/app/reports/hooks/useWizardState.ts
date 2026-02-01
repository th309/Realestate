import { useState, useCallback } from 'react';
import type {
  WizardState,
  UserType,
  GeographyType,
  Geography,
  ReportTemplate,
} from '../types';

const initialState: WizardState = {
  step: 1,
  userType: 'homebuyer',
  selectedTemplate: null,
  geoLevel: 'city', // Default to city for most common use case
  primaryGeography: null,
  comparisonGeographies: [],
  userInputs: {},
};

export interface UseWizardStateReturn extends WizardState {
  // Navigation
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;

  // User type
  setUserType: (type: UserType) => void;

  // Template selection
  setSelectedTemplate: (template: ReportTemplate | null) => void;

  // Geography selection
  setGeoLevel: (level: GeographyType) => void;
  setPrimaryGeography: (geo: Geography | null) => void;
  setGeographySelection: (geo: Geography) => void;
  addComparisonGeography: (geo: Geography) => void;
  removeComparisonGeography: (geoId: string) => void;
  clearComparisonGeographies: () => void;

  // User inputs
  setUserInput: (field: string, value: any) => void;
  setUserInputs: (inputs: Record<string, any>) => void;

  // Reset
  resetWizard: () => void;

  // Validation
  isStepValid: (step: number) => boolean;
}

export function useWizardState(): UseWizardStateReturn {
  const [state, setState] = useState<WizardState>(initialState);

  // Validation
  const isStepValid = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 1:
          return state.selectedTemplate !== null;
        case 2:
          if (!state.primaryGeography) return false;
          // Check comparison requirements
          if (state.selectedTemplate?.config.comparison) {
            const { min_geographies } = state.selectedTemplate.config.comparison;
            return state.comparisonGeographies.length >= (min_geographies - 1);
          }
          return true;
        case 3:
          // Check required user inputs
          if (!state.selectedTemplate) return true;
          const requiredInputs = state.selectedTemplate.config.user_inputs.filter(
            (input) => input.required
          );
          return requiredInputs.every(
            (input) =>
              state.userInputs[input.field_name] !== undefined &&
              state.userInputs[input.field_name] !== ''
          );
        case 4:
          return true;
        default:
          return false;
      }
    },
    [state]
  );

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 4) {
      setState((prev) => ({ ...prev, step }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 4),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1),
    }));
  }, []);

  const canGoNext = useCallback(() => {
    return state.step < 4 && isStepValid(state.step);
  }, [state.step, state.selectedTemplate, state.primaryGeography, state.comparisonGeographies, state.userInputs, isStepValid]);

  const canGoPrev = useCallback(() => {
    return state.step > 1;
  }, [state.step]);

  // User type
  const setUserType = useCallback((type: UserType) => {
    setState((prev) => ({ ...prev, userType: type }));
  }, []);

  // Template selection
  const setSelectedTemplate = useCallback((template: ReportTemplate | null) => {
    setState((prev) => ({
      ...prev,
      selectedTemplate: template,
      // Reset geography if template doesn't support current level
      geoLevel: template?.config.supported_geography_types.includes(prev.geoLevel)
        ? prev.geoLevel
        : template?.config.supported_geography_types[0] || 'metro',
      // Reset user inputs when template changes
      userInputs: {},
    }));
  }, []);

  // Geography selection
  const setGeoLevel = useCallback((level: GeographyType) => {
    setState((prev) => ({
      ...prev,
      geoLevel: level,
      primaryGeography: null,
      comparisonGeographies: [],
    }));
  }, []);

  const setPrimaryGeography = useCallback((geo: Geography | null) => {
    setState((prev) => ({ ...prev, primaryGeography: geo }));
  }, []);

  const setGeographySelection = useCallback((geo: Geography) => {
    setState((prev) => ({
      ...prev,
      geoLevel: geo.type as GeographyType,
      primaryGeography: geo,
      comparisonGeographies: prev.geoLevel === geo.type ? prev.comparisonGeographies : [],
    }));
  }, []);

  const addComparisonGeography = useCallback((geo: Geography) => {
    setState((prev) => {
      const maxComparisons = prev.selectedTemplate?.config.comparison?.max_geographies || 5;
      if (prev.comparisonGeographies.length >= maxComparisons) {
        return prev;
      }
      if (prev.comparisonGeographies.some((g) => g.id === geo.id)) {
        return prev;
      }
      return {
        ...prev,
        comparisonGeographies: [...prev.comparisonGeographies, geo],
      };
    });
  }, []);

  const removeComparisonGeography = useCallback((geoId: string) => {
    setState((prev) => ({
      ...prev,
      comparisonGeographies: prev.comparisonGeographies.filter((g) => g.id !== geoId),
    }));
  }, []);

  const clearComparisonGeographies = useCallback(() => {
    setState((prev) => ({ ...prev, comparisonGeographies: [] }));
  }, []);

  // User inputs
  const setUserInput = useCallback((field: string, value: any) => {
    setState((prev) => ({
      ...prev,
      userInputs: { ...prev.userInputs, [field]: value },
    }));
  }, []);

  const setUserInputs = useCallback((inputs: Record<string, any>) => {
    setState((prev) => ({ ...prev, userInputs: inputs }));
  }, []);

  // Reset
  const resetWizard = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    goToStep,
    nextStep,
    prevStep,
    canGoNext,
    canGoPrev,
    setUserType,
    setSelectedTemplate,
    setGeoLevel,
    setPrimaryGeography,
    setGeographySelection,
    addComparisonGeography,
    removeComparisonGeography,
    clearComparisonGeographies,
    setUserInput,
    setUserInputs,
    resetWizard,
    isStepValid,
  };
}
