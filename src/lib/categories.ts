export interface CategoryConfig {
  value: string;
  label: string;
  subcategories?: string[];
}

export const CATEGORIES: CategoryConfig[] = [
  {
    value: 'music',
    label: 'Music',
    subcategories: [
      'Rock & Alternative',
      'Pop & Electronic',
      'Hip Hop & R&B',
      'Jazz & Blues',
      'Classical & Orchestra',
      'Country & Folk',
      'Metal & Punk',
      'World Music',
    ],
  },
  {
    value: 'theatre',
    label: 'Theatre',
    subcategories: [
      'Musicals',
      'Drama',
      'Comedy Shows',
      'Ballet & Dance',
      'Opera',
      'Cabaret',
      'Shakespeare',
      'Experimental',
    ],
  },
  {
    value: 'sports',
    label: 'Sports',
    subcategories: [
      'AFL',
      'Cricket',
      'Soccer',
      'Basketball',
      'Tennis',
      'Rugby',
      'Motorsports',
      'Other Sports',
    ],
  },
  {
    value: 'arts',
    label: 'Arts & Culture',
    subcategories: [
      'Comedy Festival',
      'Film & Cinema',
      'Art Exhibitions',
      'Literary Events',
      'Cultural Festivals',
      'Markets & Fairs',
    ],
  },
  {
    value: 'family',
    label: 'Family',
    subcategories: [
      'Kids Shows',
      'Family Entertainment',
      'Educational',
      'Circus & Magic',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    subcategories: [
      'Workshops',
      'Networking',
      'Wellness',
      'Community Events',
    ],
  },
];

// Helpers
export function getCategoryLabel(value: string): string {
  const category = CATEGORIES.find(cat => cat.value === value);
  return category?.label || value;
}

export function getSubcategories(categoryValue: string): string[] {
  const category = CATEGORIES.find(cat => cat.value === categoryValue);
  return category?.subcategories || [];
}

export function isValidSubcategory(
  categoryValue: string,
  subcategory: string
): boolean {
  const subcategories = getSubcategories(categoryValue);
  return subcategories.includes(subcategory);
}