import { API_URL } from "./base";

export interface SignUpWithTourInput {
  email: string;
  password: string;
  tourSessionId: string;
}

export interface SignUpWithTourResult {
  userId: string;
  reportId: string | null;
  needsEmailConfirmation: boolean;
  magicLink: string | null;
}

export async function signUpWithTour(
  input: SignUpWithTourInput,
): Promise<SignUpWithTourResult> {
  const res = await fetch(`${API_URL}/api/anonymous/sign-up-with-tour`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Sign-up failed: ${res.status}`);
  }
  return (await res.json()) as SignUpWithTourResult;
}
