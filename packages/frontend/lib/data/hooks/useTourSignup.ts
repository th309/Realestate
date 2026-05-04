import { useMutation } from "@tanstack/react-query";
import {
  signUpWithTour,
  type SignUpWithTourInput,
  type SignUpWithTourResult,
} from "../fetchers/tour-signup";

export function useTourSignup() {
  return useMutation<SignUpWithTourResult, Error, SignUpWithTourInput>({
    mutationFn: signUpWithTour,
  });
}
