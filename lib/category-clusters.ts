export type CategoryClusterEntry = {
  query: string;
  weight: number;
};

export type ResolvedClusterEntry = {
  query: string;
  weight: number;
  isPrimary: boolean;
};

const CATEGORY_CLUSTERS: Record<string, CategoryClusterEntry[]> = {
  clothing_store: [
    { query: "clothing store", weight: 1 },
    { query: "boutique", weight: 0.6 },
    { query: "fashion store", weight: 0.6 },
    { query: "garments", weight: 0.55 },
    { query: "readymade garments", weight: 0.5 },
    { query: "garment shop", weight: 0.5 },
    { query: "textile", weight: 0.45 },
    { query: "textile store", weight: 0.45 },
    { query: "mens wear", weight: 0.4 },
    { query: "ladies wear", weight: 0.4 },
    { query: "kids wear", weight: 0.35 },
    { query: "ethnic wear", weight: 0.35 },
    { query: "saree shop", weight: 0.35 },
    { query: "mens clothing", weight: 0.35 },
    { query: "womens clothing", weight: 0.35 }
  ]
};

const MIN_WEIGHT = 0.2;

function normalizeQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveCategoryCluster(category: string): ResolvedClusterEntry[] {
  const normalizedCategory = normalizeQuery(category);
  const baseQuery = normalizedCategory.replace(/_/g, " ");
  const cluster = CATEGORY_CLUSTERS[normalizedCategory] || [];
  const entries: ResolvedClusterEntry[] = [
    { query: baseQuery, weight: 1, isPrimary: true },
    ...cluster.map((entry) => ({
      query: normalizeQuery(entry.query),
      weight: Math.max(entry.weight, MIN_WEIGHT),
      isPrimary: false
    }))
  ];

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!entry.query) return false;
    if (seen.has(entry.query)) return false;
    seen.add(entry.query);
    return true;
  });
}

export function getClusterWeights(entries: ResolvedClusterEntry[]) {
  return entries.reduce((total, entry) => total + Math.max(entry.weight, MIN_WEIGHT), 0);
}
