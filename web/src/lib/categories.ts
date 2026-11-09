export type CategoryId =
  | "science"
  | "history"
  | "geography"
  | "technology"
  | "arts"
  | "nature"
  | "human_body"
  | "sports";

export type CategoryMeta = {
  id: CategoryId;
  label: string;
  blurb: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { id: "science", label: "Science", blurb: "Forces, cells, and cosmic quirks" },
  { id: "history", label: "History", blurb: "Dates that almost sound right" },
  { id: "geography", label: "Geography", blurb: "Rivers, ranges, and edges of maps" },
  { id: "technology", label: "Technology", blurb: "Circuits, code, and inventions" },
  { id: "arts", label: "Arts", blurb: "Canvases, stages, and scores" },
  { id: "nature", label: "Nature", blurb: "Migrations, reefs, and wild systems" },
  {
    id: "human_body",
    label: "Human Body",
    blurb: "Organs, sleep, and quiet biology",
  },
  { id: "sports", label: "Sports", blurb: "Records, rules, and arenas" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}
