/**
 * Maps event data from various sources to normalised category and subcategory values.
 * 
 * This module provides source-specific mapping functions that analyse event metadata
 * (titles, genres, tags) to assign consistent category classifications across all sources.
 */

import { SHAKESPEARE_PLAYS } from '@/lib/constants/categories';

/**
 * Detects if an event title contains a Shakespeare play.
 * 
 * @param title - Event title to check
 * @returns True if a Shakespeare play is detected
 */
function isShakespearePlay(title: string): boolean {
  const titleLower = title.toLowerCase();

  // Check for explicit Shakespeare mention
  if (titleLower.includes('shakespeare')) {
    return true;
  }

  // Check for known Shakespeare plays
  return SHAKESPEARE_PLAYS.some(play => titleLower.includes(play));
}

/**
 * Maps What's On Melbourne category tags to normalised categories.
 * 
 * @param categoryTag - Original category tag from What's On Melbourne
 * @param title - Event title for additional context in classification
 * @returns Normalised category and subcategory
 */
export function mapWhatsOnCategory(
  categoryTag: string,
  title: string
): { category: string; subcategory?: string } {
  const titleLower = title.toLowerCase();
  const tagLower = categoryTag.toLowerCase();

  // Map What's On categories to our categories
  switch (tagLower) {
    case 'theatre and musicals':
    case 'theatre':
      return classifyTheatre(titleLower);

    case 'music and concerts':
    case 'music':
      return classifyMusic(titleLower);

    case 'festival':
    case 'festivals':
      // Festivals can be music, comedy, or cultural
      if (titleLower.includes('comedy')) {
        return { category: 'arts', subcategory: 'Comedy Festival' };
      }
      if (titleLower.includes('music') || titleLower.includes('concert')) {
        return classifyMusic(titleLower);
      }
      return { category: 'arts', subcategory: 'Cultural Festivals' };

    case 'family and kids':
    case 'family':
      return classifyFamily(titleLower);

    case 'art':
    case 'arts':
      return classifyArts(titleLower);

    case 'exhibition':
      return { category: 'arts', subcategory: 'Art Exhibitions' };

    case 'market':
      return { category: 'arts', subcategory: 'Markets & Fairs' };

    case 'comedy':
      return { category: 'theatre', subcategory: 'Comedy Shows' };

    case 'sport':
      return { category: 'sports', subcategory: 'Other Sports' };

    case 'events':
    case 'entertainment':
    case 'attractions':
    case 'christmas':
    default:
      return { category: 'other', subcategory: 'Community Events' };
  }
}

/**
 * Maps Ticketmaster segment/genre data to normalised categories.
 * 
 * @param segment - Top-level Ticketmaster segment (e.g., 'Music', 'Sports')
 * @param genre - Genre classification
 * @param subGenre - Sub-genre classification (optional)
 * @param title - Event title for additional context
 * @returns Normalised category and subcategory
 */
export function mapTicketmasterCategory(
  segment?: string,
  genre?: string,
  subGenre?: string,
  title?: string
): { category: string; subcategory?: string } {
  const titleLower = title?.toLowerCase() || '';
  const genreLower = genre?.toLowerCase() || '';

  switch (segment) {
    case 'Music':
      return classifyTicketmasterMusic(genreLower, titleLower);

    case 'Sport':
    case 'Sports':
      return classifyTicketmasterSports(genreLower);

    case 'Arts & Theatre':
    case 'Arts, Theatre & Comedy':
      return classifyTicketmasterTheatre(genreLower, titleLower);

    case 'Film':
      return { category: 'arts', subcategory: 'Film & Cinema' };

    case 'Family & Attractions':
      return classifyTicketmasterFamily(genreLower, titleLower);

    case 'Miscellaneous':
      if (genreLower.includes('family')) {
        return { category: 'family', subcategory: 'Family Entertainment' };
      }
      if (titleLower.includes('comedy festival')) {
        return { category: 'arts', subcategory: 'Comedy Festival' };
      }
      return { category: 'other', subcategory: 'Community Events' };

    default:
      // If no segment provided, try to classify by title
      if (titleLower) {
        return classifyByTitle(titleLower);
      }
      return { category: 'other', subcategory: 'Community Events' };
  }
}

/**
 * Maps Marriner Group events to normalised categories.
 * 
 * Marriner operates major Melbourne theatres, so most events default to theatre.
 * Marriner categories: Musical, Concert, Comedy, Play, Family, Other
 * 
 * @param title - Event title
 * @param venue - Venue name for additional context
 * @param marrinerCategory - Optional Marriner category if available
 * @returns Normalised category and subcategory
 */
export function mapMarrinerCategory(
  title: string,
  venue: string,
  marrinerCategory?: string
): { category: string; subcategory?: string } {
  const titleLower = title.toLowerCase();
  const categoryLower = marrinerCategory?.toLowerCase() || '';

  // Use Marriner category if provided
  if (categoryLower === 'concert') {
    return classifyMusic(titleLower);
  }

  if (categoryLower === 'musical') {
    return { category: 'theatre', subcategory: 'Musicals' };
  }

  if (categoryLower === 'comedy') {
    return { category: 'theatre', subcategory: 'Comedy Shows' };
  }

  if (categoryLower === 'play') {
    return classifyTheatre(titleLower, venue);
  }

  if (categoryLower === 'family') {
    return classifyFamily(titleLower);
  }

  // Fallback to title-based classification
  // Check for music events first
  if (titleLower.includes('concert') ||
    titleLower.includes('symphony') ||
    titleLower.includes('orchestra')) {
    return { category: 'music', subcategory: 'Classical & Orchestra' };
  }

  if (titleLower.includes('jazz') || titleLower.includes('blues')) {
    return { category: 'music', subcategory: 'Jazz & Blues' };
  }

  if (titleLower.includes('rock') || titleLower.includes('alternative')) {
    return { category: 'music', subcategory: 'Rock & Alternative' };
  }

  if (titleLower.includes('pop') && !titleLower.includes('opera')) {
    return { category: 'music', subcategory: 'Pop & Electronic' };
  }

  // Most Marriner events are theatre
  return classifyTheatre(titleLower, venue);
}

/**
 * Classifies theatre events based on title keywords.
 */
function classifyTheatre(titleLower: string, venue?: string): { category: string; subcategory?: string } {
  // Check for Shakespeare first (takes priority)
  if (isShakespearePlay(titleLower)) {
    return { category: 'theatre', subcategory: 'Shakespeare' };
  }

  if (titleLower.includes('musical')) {
    return { category: 'theatre', subcategory: 'Musicals' };
  }

  if (titleLower.includes('opera')) {
    return { category: 'theatre', subcategory: 'Opera' };
  }

  if (titleLower.includes('ballet') ||
    titleLower.includes('nutcracker') ||
    titleLower.includes('dance')) {
    return { category: 'theatre', subcategory: 'Ballet & Dance' };
  }

  if (titleLower.includes('comedy') || venue?.toLowerCase().includes('comedy')) {
    return { category: 'theatre', subcategory: 'Comedy Shows' };
  }

  if (titleLower.includes('cabaret')) {
    return { category: 'theatre', subcategory: 'Cabaret' };
  }

  if (titleLower.includes('experimental')) {
    return { category: 'theatre', subcategory: 'Experimental' };
  }

  return { category: 'theatre', subcategory: 'Drama' };
}

/**
 * Classifies music events based on title keywords.
 */
function classifyMusic(titleLower: string): { category: string; subcategory?: string } {
  if (titleLower.includes('classical') ||
    titleLower.includes('orchestra') ||
    titleLower.includes('symphony')) {
    return { category: 'music', subcategory: 'Classical & Orchestra' };
  }

  if (titleLower.includes('jazz') || titleLower.includes('blues')) {
    return { category: 'music', subcategory: 'Jazz & Blues' };
  }

  if (titleLower.includes('metal') || titleLower.includes('punk')) {
    return { category: 'music', subcategory: 'Metal & Punk' };
  }

  if (titleLower.includes('rock') ||
    titleLower.includes('alternative') ||
    titleLower.includes('indie')) {
    return { category: 'music', subcategory: 'Rock & Alternative' };
  }

  if (titleLower.includes('pop') ||
    titleLower.includes('electronic') ||
    titleLower.includes('edm')) {
    return { category: 'music', subcategory: 'Pop & Electronic' };
  }

  if (titleLower.includes('hip hop') ||
    titleLower.includes('rap') ||
    titleLower.includes('r&b') ||
    titleLower.includes('rnb')) {
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

  // Default for unclassified music
  return { category: 'music', subcategory: 'Pop & Electronic' };
}

/**
 * Classifies Ticketmaster music events by genre.
 */
function classifyTicketmasterMusic(genreLower: string, titleLower: string): { category: string; subcategory?: string } {
  // Check for metal/punk before rock (since "Hard Rock/Metal" contains "rock")
  if (genreLower.includes('metal') || genreLower.includes('hard rock')) {
    return { category: 'music', subcategory: 'Metal & Punk' };
  }

  if (genreLower.includes('alternative') || genreLower.includes('rock')) {
    return { category: 'music', subcategory: 'Rock & Alternative' };
  }

  if (genreLower.includes('jazz') || genreLower.includes('blues')) {
    return { category: 'music', subcategory: 'Jazz & Blues' };
  }

  if (genreLower.includes('classical')) {
    return { category: 'music', subcategory: 'Classical & Orchestra' };
  }

  if (genreLower.includes('hip-hop') || genreLower.includes('rap') ||
    genreLower.includes('r&b') || genreLower.includes('urban')) {
    return { category: 'music', subcategory: 'Hip Hop & R&B' };
  }

  if (genreLower.includes('country') || genreLower.includes('folk')) {
    return { category: 'music', subcategory: 'Country & Folk' };
  }

  if (genreLower.includes('metal') || genreLower.includes('hard rock')) {
    return { category: 'music', subcategory: 'Metal & Punk' };
  }

  if (genreLower.includes('world')) {
    return { category: 'music', subcategory: 'World Music' };
  }

  // Use title as fallback
  if (titleLower) {
    const titleResult = classifyMusic(titleLower);
    if (titleResult.subcategory) {
      return titleResult;
    }
  }

  return { category: 'music', subcategory: 'Pop & Electronic' };
}

/**
 * Classifies Ticketmaster sports events by genre.
 */
function classifyTicketmasterSports(genreLower: string): { category: string; subcategory?: string } {
  if (genreLower.includes('afl') || genreLower.includes('football')) {
    return { category: 'sports', subcategory: 'AFL' };
  }

  if (genreLower.includes('cricket')) {
    return { category: 'sports', subcategory: 'Cricket' };
  }

  if (genreLower.includes('soccer')) {
    return { category: 'sports', subcategory: 'Soccer' };
  }

  if (genreLower.includes('basketball')) {
    return { category: 'sports', subcategory: 'Basketball' };
  }

  if (genreLower.includes('tennis')) {
    return { category: 'sports', subcategory: 'Tennis' };
  }

  if (genreLower.includes('rugby')) {
    return { category: 'sports', subcategory: 'Rugby' };
  }

  if (genreLower.includes('motorsport') || genreLower.includes('racing')) {
    return { category: 'sports', subcategory: 'Motorsports' };
  }

  return { category: 'sports', subcategory: 'Other Sports' };
}

/**
 * Classifies Ticketmaster theatre events by genre.
 */
function classifyTicketmasterTheatre(genreLower: string, titleLower: string): { category: string; subcategory?: string } {
  if (genreLower.includes('musical')) {
    return { category: 'theatre', subcategory: 'Musicals' };
  }

  if (genreLower.includes('opera')) {
    return { category: 'theatre', subcategory: 'Opera' };
  }

  if (genreLower.includes('ballet') || genreLower.includes('dance')) {
    return { category: 'theatre', subcategory: 'Ballet & Dance' };
  }

  if (genreLower.includes('comedy')) {
    return { category: 'theatre', subcategory: 'Comedy Shows' };
  }

  if (genreLower.includes('play')) {
    return classifyTheatre(titleLower);
  }

  // Fallback to title-based classification
  if (titleLower) {
    return classifyTheatre(titleLower);
  }

  return { category: 'theatre', subcategory: 'Drama' };
}

/**
 * Classifies Ticketmaster family events by genre.
 */
function classifyTicketmasterFamily(genreLower: string, titleLower: string): { category: string; subcategory?: string } {
  if (genreLower.includes('children') || genreLower.includes('kids')) {
    return { category: 'family', subcategory: 'Kids Shows' };
  }

  if (genreLower.includes('circus') || genreLower.includes('magic')) {
    return { category: 'family', subcategory: 'Circus & Magic' };
  }

  if (genreLower.includes('ice show')) {
    return { category: 'family', subcategory: 'Family Entertainment' };
  }

  // Fallback to title-based classification
  if (titleLower) {
    return classifyFamily(titleLower);
  }

  return { category: 'family', subcategory: 'Family Entertainment' };
}

/**
 * Classifies family events based on title keywords.
 */
function classifyFamily(titleLower: string): { category: string; subcategory?: string } {
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

/**
 * Classifies arts and culture events based on title keywords.
 */
function classifyArts(titleLower: string): { category: string; subcategory?: string } {
  if (titleLower.includes('film') ||
    titleLower.includes('cinema') ||
    titleLower.includes('movie')) {
    return { category: 'arts', subcategory: 'Film & Cinema' };
  }

  if (titleLower.includes('exhibition') || titleLower.includes('gallery')) {
    return { category: 'arts', subcategory: 'Art Exhibitions' };
  }

  if (titleLower.includes('book') ||
    titleLower.includes('author') ||
    titleLower.includes('poetry')) {
    return { category: 'arts', subcategory: 'Literary Events' };
  }

  if (titleLower.includes('market') || titleLower.includes('fair')) {
    return { category: 'arts', subcategory: 'Markets & Fairs' };
  }

  return { category: 'arts', subcategory: 'Cultural Festivals' };
}

/**
 * Attempts to classify events by title alone when no other metadata is available.
 */
function classifyByTitle(titleLower: string): { category: string; subcategory?: string } {
  // Check music first
  if (titleLower.includes('concert') || titleLower.includes('band') ||
    titleLower.includes('singer') || titleLower.includes('tour')) {
    return classifyMusic(titleLower);
  }

  // Check theatre
  if (titleLower.includes('musical') || titleLower.includes('play') ||
    titleLower.includes('theatre') || titleLower.includes('opera') ||
    titleLower.includes('ballet') || titleLower.includes('comedy show')) {
    return classifyTheatre(titleLower);
  }

  // Check sports
  if (titleLower.includes('afl') || titleLower.includes('cricket') ||
    titleLower.includes('soccer') || titleLower.includes('rugby') ||
    titleLower.includes('game') || titleLower.includes('match') ||
    titleLower.includes('grand final') || titleLower.includes('championship')) {
    return { category: 'sports', subcategory: 'Other Sports' };
  }

  // Check family
  if (titleLower.includes('kids') || titleLower.includes('family') ||
    titleLower.includes('children')) {
    return classifyFamily(titleLower);
  }

  // Check arts
  if (titleLower.includes('exhibition') || titleLower.includes('film') ||
    titleLower.includes('festival')) {
    return classifyArts(titleLower);
  }

  return { category: 'other', subcategory: 'Community Events' };
}