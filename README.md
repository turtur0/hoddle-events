# Hoddle

![Hoddle Homepage](docs/homepage.png)

**Discover Melbourne's events in one place**

[Live Demo](https://www.hoddleevents.com.au/) | [Features](#features) | [Tech Stack](#tech-stack)

---

A full-stack events aggregator that solves Melbourne's fragmented event discovery problem by combining multiple ticketing, venue and events platforms into one searchable database. Features data deduplication, ML-based recommendations, event analytics, custom automated in-app and email notifications, and a historical archive of past events.

---

## Features

### Unified Search

Browse thousands of events from multiple sources in one place. Advanced filtering by category, subcategory, date range, and price. Smart deduplication ensures each event appears once, even when listed across multiple platforms.

![Search and filtering on events page](docs/unified-search.gif)

---

### Personalised Recommendations

Content-based filtering system that learns from your interactions. Events are represented as ~49-dimensional vectors (category, subcategories, price, venue tier, popularity), and cosine similarity matches them to your computed user profile. The system blends explicit preferences (onboarding selections) with learnt behaviour (favourites, clicks, views) using regularised weighted averaging, with time-decay for recency bias and cold-start handling for new users.

!["For You" and "Trending" recommendation section*](docs/personalised-reccomendations-ezgif.com-video-to-gif-converter.gif)

---

### Smart Notifications

Granular notification controls let you set keyword alerts, category preferences, and popularity filters. Choose between weekly or monthly email digests, and control recommendation volume per category (1-20 events). Minimum match score filtering ensures you only get notified about truly relevant events.

![Notififcation page](docs/notifications.png)

---

### Analytics Dashboard

Interactive charts visualising price distributions, event timelines, and popularity metrics across categories. Compare individual events' pricing against their category, identify pricing trends, and discover the best-value tickets. Built with Recharts for responsive, real-time data visualisation.

![INSERT: Analytics charts screenshot showing price distribution/timeline](docs/analytics.gif)

---

### Historical Archive

Complete record of past Melbourne events preserved for cultural research and trend analysis. Searchable archive maintains venue histories, pricing data, and event metadata—useful for academic research, market analysis, or simply rediscovering what you might have missed.

![INSERT: Archive page screenshot](docs/archieved-events.png)

---

### Automated Data Pipeline

Daily/weekly scraping jobs collect events from all sources. Implements ethical scraping practices (robots.txt compliance, rate limiting) with automated deduplication and data validation. Scheduled cron jobs keep the database fresh without manual intervention.

---

## Technical Highlights

### Intelligent Data Pipeline

**Flow**: Daily cron jobs → Source-specific scrapers → Data normalisation → Fuzzy deduplication → MongoDB storage → Popularity percentile updates

**Deduplication Strategy**:
- Buckets events by first 3 title words to reduce comparison space from O(n²) to O(b × k²)
- Quick character-overlap filter rejects 50-70% of pairs before expensive string comparison
- Weighted scoring: title similarity (50%, Sørensen-Dice), date overlap (30%), venue match (20%)
- Threshold: 78% combined score flags duplicates, merges to most complete data
- **Ethical scraping**: Respects robots.txt, implements exponential backoff rate limiting, and uses official APIs wherever available

---

### ML Recommendation System

**Vector Representation** (~49 dimensions per event):
- Category encoding (6 dims, one-hot, heavily weighted at 10.0x)
- Subcategory encoding (~40 dims, multi-hot, weighted at 5.0x)
- Price (log-scaled), venue tier (0-1 mainstream score), popularity percentile
- Feature weights create hierarchical importance: category > subcategory > popularity > price/venue

**User Profile Computation**:
- **Interaction-based learning**: Builds user vector from last 6 months of favourites (5.0x), clickthroughs (3.0x), and views (1.0x)
- **Time decay**: Exponential decay (30-day half-life) prioritises recent behaviour
- **Regularised blending**: Combines 30% explicit preferences (onboarding) + 70% learnt behaviour to prevent overfitting
- **L2 normalisation**: Ensures consistent similarity calculations

**Scoring Algorithm** (multi-factor):
- Content similarity (60%): Cosine similarity between user and event vectors
- Popularity matching (20%): Aligns with user's mainstream/hidden gem preference
- Novelty bonus (10%): Diversity injection—reduces similarity to recent favourites
- Temporal relevance (10%): Urgency boost for upcoming events

**Cold-Start Strategy**:
- New users: 100% explicit preferences from onboarding
- Confidence score grows with interaction count (20+ interactions = full confidence)
- Falls back to venue tier, price, and multi-source signals for new events

**Popularity Ranking**:
- Category-relative percentiles (0.0 = least popular, 1.0 = most popular)
- Weighted engagement: favourites (5.0x) > clickthroughs (3.0x) > views (0.5x)
- Venue capacity proxy (log-scaled to prevent stadium dominance)
- Daily batch updates via cron job maintain fresh percentiles

![Setting page showing preferences](docs/ml-recommendations.gif)

---

## Tech Stack

**Frontend**
- Next.js (App Router)
- React
- TypeScript
- Tailwind 
- shadcn/ui 

**Backend**
- Next.js API Routes
- MongoDB 
- Mongoose (ODM)
- NextAuth.js (Google OAuth)

**ML & Analytics**
- Custom vector similarity engine
- Recharts

**Data Collection**
- Cheerio & Puppeteer (web scraping)
- Rate limiting & robots.txt compliance

**Email**
- Resend (transactional email)
- React Email (template engine)

**Tools & Deployment**
- Vercel (hosting & edge functions)
- Jest 30 (testing framework)

---

## Data Sources

- **Ticketmaster**: Major concerts, sports, and theatre via official API
- **Marriner Group**: Premium venues (Regent, Princess, Comedy Theatre, Forum, Plaza)
- **What's On Melbourne**: Community festivals and cultural events

All data collection follows ethical practices: official APIs first, robots.txt compliance, rate limiting, and direct attribution to sources.

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance
- API keys (Ticketmaster, Google OAuth)

### Installation
```bash
# Clone the repository
git clone git@github.com:[your username]/hoddle-events.git
cd hoddle

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

---

## Future Enhancements

- [ ] Collaborative filtering for recommendations
- [ ] Implement more scrapers for additional sources
- [ ] External API integration (Spotify for artist popularity, Google Trends for search volume to improve popularity ratings)
- [ ] Social features (friend recommendations, event sharing)

---

## Licence

MIT Licence - see [LICENCE](LICENCE) file for details.

---

*Built as a portfolio project to demonstrate full-stack development, ML implementation, and data engineering capabilities.*