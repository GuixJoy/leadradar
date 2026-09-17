export type CategoryIntent = {
  discoveryTerms: string[];
  acceptedTypes: string[];
  nameKeywords: string[];
};

export type CategoryIntentMap = Record<string, CategoryIntent>;

export type CategoryIntentResolution = {
  key: string;
  intent: CategoryIntent;
};

export const CATEGORY_INTENTS: CategoryIntentMap = {
  apparel: {
    discoveryTerms: [
      "boutique",
      "garments",
      "ladies wear",
      "mens wear",
      "ethnic wear",
      "fashion store",
      "saree shop",
      "textile",
      "readymade garments",
      "kids wear",
      "designer wear"
    ],
    acceptedTypes: [
      "clothing_store",
      "designer_clothing_store",
      "fashion_accessories_store",
      "outlet_mall",
      "store",
      "boutique",
      "shopping_mall",
      "department_store"
    ],
    nameKeywords: [
      "fashion",
      "wear",
      "garments",
      "boutique",
      "collection",
      "textile",
      "apparel",
      "saree",
      "ethnic",
      "designer"
    ]
  }
};

export const CATEGORY_INTENT_ALIASES: Record<string, string> = {
  apparel: "apparel",
  clothing_store: "apparel",
  designer_clothing_store: "apparel",
  fashion_accessories_store: "apparel",
  boutique: "apparel",
  store: "apparel",
  outlet_mall: "apparel",
  department_store: "apparel",
  shopping_mall: "apparel"
};

export const GENERIC_PLACE_TYPES = new Set([
  "store",
  "point_of_interest",
  "establishment"
]);

const normalizeKey = (value: string) => value.trim().toLowerCase();

export function getCategoryIntent(category: string): CategoryIntentResolution | null {
  const normalized = normalizeKey(category || "");
  if (!normalized) return null;
  const aliasKey = CATEGORY_INTENT_ALIASES[normalized] || normalized;
  const intent = CATEGORY_INTENTS[aliasKey];
  if (!intent) return null;
  return { key: aliasKey, intent };
}

export function normalizeIntentToken(value: string) {
  return normalizeKey(value).replace(/[_]+/g, " ");
}

export function isGenericPlaceType(placeType: string) {
  return GENERIC_PLACE_TYPES.has(normalizeKey(placeType));
}
