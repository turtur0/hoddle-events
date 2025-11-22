// ============================================
// category-mapper.ts
// Centralized category mapping for all sources
// ============================================

/**
 * Map What's On Melbourne categories to normalized categories
 */
export function mapWhatsOnCategory(
  categoryTag: string,
  title: string
): { category: string; subcategory?: string } {
  const titleLower = title.toLowerCase();

  // Theatre category
  if (categoryTag === 'theatre') {
    if (titleLower.includes('musical')) {
      return { category: 'theatre', subcategory: 'Musicals' };
    }
    if (titleLower.includes('comedy')) {
      return { category: 'theatre', subcategory: 'Comedy Shows' };
    }
    if (titleLower.includes('opera')) {
      return { category: 'theatre', subcategory: 'Opera' };
    }
    if (titleLower.includes('ballet') || titleLower.includes('dance')) {
      return { category: 'theatre', subcategory: 'Ballet & Dance' };
    }
    if (titleLower.includes('cabaret')) {
      return { category: 'theatre', subcategory: 'Cabaret' };
    }
    if (titleLower.includes('shakespeare')) {
      return { category: 'theatre', subcategory: 'Shakespeare' };
    }
    return { category: 'theatre', subcategory: 'Drama' };
  }

  // Music category
  if (categoryTag === 'music') {
    if (titleLower.includes('classical') || titleLower.includes('orchestra') || titleLower.includes('symphony')) {
      return { category: 'music', subcategory: 'Classical & Orchestra' };
    }
    if (titleLower.includes('jazz') || titleLower.includes('blues')) {
      return { category: 'music', subcategory: 'Jazz & Blues' };
    }
    if (titleLower.includes('rock') || titleLower.includes('alternative') || titleLower.includes('indie')) {
      return { category: 'music', subcategory: 'Rock & Alternative' };
    }
    if (titleLower.includes('pop') || titleLower.includes('electronic') || titleLower.includes('edm')) {
      return { category: 'music', subcategory: 'Pop & Electronic' };
    }
    if (titleLower.includes('hip hop') || titleLower.includes('rap') || titleLower.includes('r&b') || titleLower.includes('rnb')) {
      return { category: 'music', subcategory: 'Hip Hop & R&B' };
    }
    if (titleLower.includes('country') || titleLower.includes('folk')) {
      return { category: 'music', subcategory: 'Country & Folk' };
    }
    if (titleLower.includes('metal') || titleLower.includes('punk')) {
      return { category: 'music', subcategory: 'Metal & Punk' };
    }
    if (titleLower.includes('world music') || titleLower.includes('ethnic')) {
      return { category: 'music', subcategory: 'World Music' };
    }
    return { category: 'music', subcategory: 'Pop & Electronic' };
  }

  // Festivals category
  if (categoryTag === 'festivals') {
    if (titleLower.includes('comedy')) {
      return { category: 'arts', subcategory: 'Comedy Festival' };
    }
    return { category: 'arts', subcategory: 'Cultural Festivals' };
  }

  // Family category
  if (categoryTag === 'family') {
    if (titleLower.includes('kids') || titleLower.includes('children')) {
      return { category: 'family', subcategory: 'Kids Shows' };
    }
    if (titleLower.includes('circus') || titleLower.includes('magic')) {
      return { category: 'family', subcategory: 'Circus & Magic' };
    }
    if (titleLower.includes('education')) {
      return { category: 'family', subcategory: 'Educational' };
    }
    return { category: 'family', subcategory: 'Family Entertainment' };
  }

  // Arts & Culture
  if (categoryTag === 'arts' || categoryTag === 'art') {
    if (titleLower.includes('film') || titleLower.includes('cinema') || titleLower.includes('movie')) {
      return { category: 'arts', subcategory: 'Film & Cinema' };
    }
    if (titleLower.includes('exhibition') || titleLower.includes('gallery')) {
      return { category: 'arts', subcategory: 'Art Exhibitions' };
    }
    if (titleLower.includes('book') || titleLower.includes('author') || titleLower.includes('poetry')) {
      return { category: 'arts', subcategory: 'Literary Events' };
    }
    if (titleLower.includes('market') || titleLower.includes('fair')) {
      return { category: 'arts', subcategory: 'Markets & Fairs' };
    }
    return { category: 'arts', subcategory: 'Cultural Festivals' };
  }

  // Default
  return { category: 'other', subcategory: 'Community Events' };
}

/**
 * Map Ticketmaster categories to normalized categories
 */
export function mapTicketmasterCategory(
  segment?: string,
  genre?: string,
  subGenre?: string,
  title?: string
): { category: string; subcategory?: string } {
  const titleLower = title?.toLowerCase() || '';

  if (segment === 'Music') {
    if (genre === 'Rock' || genre === 'Alternative') {
      return { category: 'music', subcategory: 'Rock & Alternative' };
    }
    if (genre === 'Pop' || genre === 'Electronic') {
      return { category: 'music', subcategory: 'Pop & Electronic' };
    }
    if (genre === 'Jazz' || genre === 'Blues') {
      return { category: 'music', subcategory: 'Jazz & Blues' };
    }
    if (genre === 'Classical' || genre === 'Orchestra' || genre === 'Symphony') {
      return { category: 'music', subcategory: 'Classical & Orchestra' };
    }
    if (genre === 'Hip-Hop/Rap' || genre === 'R&B' || genre === 'Hip Hop') {
      return { category: 'music', subcategory: 'Hip Hop & R&B' };
    }
    if (genre === 'Country' || genre === 'Folk') {
      return { category: 'music', subcategory: 'Country & Folk' };
    }
    if (genre === 'Metal' || genre === 'Punk') {
      return { category: 'music', subcategory: 'Metal & Punk' };
    }
    if (genre === 'World') {
      return { category: 'music', subcategory: 'World Music' };
    }
    return { category: 'music', subcategory: 'Pop & Electronic' };
  }

  if (segment === 'Sports') {
    if (genre === 'Football' || genre === 'AFL') {
      return { category: 'sports', subcategory: 'AFL' };
    }
    if (genre === 'Cricket') {
      return { category: 'sports', subcategory: 'Cricket' };
    }
    if (genre === 'Soccer') {
      return { category: 'sports', subcategory: 'Soccer' };
    }
    if (genre === 'Basketball') {
      return { category: 'sports', subcategory: 'Basketball' };
    }
    if (genre === 'Tennis') {
      return { category: 'sports', subcategory: 'Tennis' };
    }
    if (genre === 'Rugby') {
      return { category: 'sports', subcategory: 'Rugby' };
    }
    if (genre === 'Motor Sports' || genre === 'Racing') {
      return { category: 'sports', subcategory: 'Motorsports' };
    }
    return { category: 'sports', subcategory: 'Other Sports' };
  }

  if (segment === 'Arts & Theatre') {
    if (titleLower.includes('musical')) {
      return { category: 'theatre', subcategory: 'Musicals' };
    }
    if (titleLower.includes('opera')) {
      return { category: 'theatre', subcategory: 'Opera' };
    }
    if (titleLower.includes('ballet') || titleLower.includes('dance')) {
      return { category: 'theatre', subcategory: 'Ballet & Dance' };
    }
    if (titleLower.includes('comedy')) {
      return { category: 'theatre', subcategory: 'Comedy Shows' };
    }
    if (titleLower.includes('cabaret')) {
      return { category: 'theatre', subcategory: 'Cabaret' };
    }
    if (titleLower.includes('shakespeare')) {
      return { category: 'theatre', subcategory: 'Shakespeare' };
    }
    if (titleLower.includes('experimental')) {
      return { category: 'theatre', subcategory: 'Experimental' };
    }
    return { category: 'theatre', subcategory: 'Drama' };
  }

  if (segment === 'Film') {
    return { category: 'arts', subcategory: 'Film & Cinema' };
  }

  if (segment === 'Miscellaneous') {
    if (genre === 'Family') {
      return { category: 'family', subcategory: 'Family Entertainment' };
    }
    if (titleLower.includes('comedy festival')) {
      return { category: 'arts', subcategory: 'Comedy Festival' };
    }
    return { category: 'other', subcategory: 'Community Events' };
  }

  return { category: 'other', subcategory: 'Community Events' };
}

/**
 * Map Marriner categories to normalized categories
 */
export function mapMarrinerCategory(
  title: string,
  venue: string
): { category: string; subcategory?: string } {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('musical') || titleLower.includes('mj the musical')) {
    return { category: 'theatre', subcategory: 'Musicals' };
  }

  if (titleLower.includes('opera')) {
    return { category: 'theatre', subcategory: 'Opera' };
  }

  if (titleLower.includes('ballet') || titleLower.includes('nutcracker') || titleLower.includes('dance')) {
    return { category: 'theatre', subcategory: 'Ballet & Dance' };
  }

  if (titleLower.includes('comedy') || venue.includes('Comedy')) {
    return { category: 'theatre', subcategory: 'Comedy Shows' };
  }

  if (titleLower.includes('cabaret')) {
    return { category: 'theatre', subcategory: 'Cabaret' };
  }

  if (titleLower.includes('shakespeare')) {
    return { category: 'theatre', subcategory: 'Shakespeare' };
  }

  if (titleLower.includes('concert') || titleLower.includes('symphony') || titleLower.includes('orchestra')) {
    return { category: 'music', subcategory: 'Classical & Orchestra' };
  }

  if (titleLower.includes('jazz') || titleLower.includes('blues')) {
    return { category: 'music', subcategory: 'Jazz & Blues' };
  }

  if (titleLower.includes('rock') || titleLower.includes('alternative')) {
    return { category: 'music', subcategory: 'Rock & Alternative' };
  }

  if (titleLower.includes('pop')) {
    return { category: 'music', subcategory: 'Pop & Electronic' };
  }

  // Default to theatre drama for Marriner venues (they're mostly theatre venues)
  return { category: 'theatre', subcategory: 'Drama' };
}