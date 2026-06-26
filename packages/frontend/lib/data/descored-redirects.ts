// Generated monthly by scripts/generate-descored-redirects.ts. Do not hand-edit.
import raw from "./descored-redirects.json";

export interface DescoredRedirect {
  source: string;
  destination: string;
  permanent: false;
}

export const DESCORED_REDIRECTS: DescoredRedirect[] = raw as DescoredRedirect[];
