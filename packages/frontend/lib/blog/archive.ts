import { SLUG_TO_STATE, ABBREV_TO_STATE } from "@/lib/data/state-slug-data";
import { getAllPosts } from "./index";
import type { BlogPost } from "./types";

export interface ArchiveMonth {
  month: string; // "04"
  name: string; // "April"
  count: number;
}

export interface ArchiveYear {
  year: string; // "2026"
  count: number;
  months: ArchiveMonth[]; // newest first
}

export interface StateIndexEntry {
  abbrev: string;
  slug: string;
  name: string;
  count: number;
}

export interface StateIndex {
  states: StateIndexEntry[]; // A–Z by name
  nationalCount: number;
}

/** Reserved /blog/states/* slug for posts with states: []. */
export const NATIONAL_SLUG = "national";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month: string): string {
  return MONTH_NAMES[Number(month) - 1] ?? month;
}

// Dates are ISO "YYYY-MM-DD"; slice instead of Date() to avoid TZ shifts.
const yearOf = (p: BlogPost) => p.frontmatter.date.slice(0, 4);
const monthOf = (p: BlogPost) => p.frontmatter.date.slice(5, 7);

export function buildArchiveTree(posts: BlogPost[]): ArchiveYear[] {
  const years = new Map<string, Map<string, number>>();
  for (const post of posts) {
    const year = yearOf(post);
    const month = monthOf(post);
    const months = years.get(year) ?? new Map<string, number>();
    months.set(month, (months.get(month) ?? 0) + 1);
    years.set(year, months);
  }
  return [...years.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, months]) => {
      const monthEntries = [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, count]) => ({ month, name: monthName(month), count }));
      return {
        year,
        count: monthEntries.reduce((sum, m) => sum + m.count, 0),
        months: monthEntries,
      };
    });
}

export function filterPostsByMonth(
  posts: BlogPost[],
  year: string,
  month: string,
): BlogPost[] {
  return posts.filter((p) => yearOf(p) === year && monthOf(p) === month);
}

export function buildStateIndex(posts: BlogPost[]): StateIndex {
  const counts = new Map<string, number>();
  let nationalCount = 0;
  for (const post of posts) {
    const states = post.frontmatter.states;
    if (states.length === 0) {
      nationalCount++;
      continue;
    }
    for (const abbrev of states) {
      counts.set(abbrev, (counts.get(abbrev) ?? 0) + 1);
    }
  }
  const states = [...counts.entries()]
    .flatMap(([abbrev, count]) => {
      const entry = ABBREV_TO_STATE.get(abbrev);
      return entry ? [{ ...entry, count }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { states, nationalCount };
}

export function filterPostsByStateSlug(
  posts: BlogPost[],
  stateSlug: string,
): BlogPost[] {
  if (stateSlug === NATIONAL_SLUG) {
    return posts.filter((p) => p.frontmatter.states.length === 0);
  }
  const entry = SLUG_TO_STATE.get(stateSlug);
  if (!entry) return [];
  return posts.filter((p) => p.frontmatter.states.includes(entry.abbrev));
}

export function getArchiveTree(): ArchiveYear[] {
  return buildArchiveTree(getAllPosts());
}

export function getPostsByMonth(year: string, month: string): BlogPost[] {
  return filterPostsByMonth(getAllPosts(), year, month);
}

export function getStateIndex(): StateIndex {
  return buildStateIndex(getAllPosts());
}

export function getPostsByState(stateSlug: string): BlogPost[] {
  return filterPostsByStateSlug(getAllPosts(), stateSlug);
}
