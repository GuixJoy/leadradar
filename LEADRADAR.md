# LeadRadar - Business Lead Discovery & Enrichment Platform

A modern SaaS application for discovering, filtering, and enriching high-quality business leads with real-time map visualization and advanced filtering capabilities.

## Features

### Core Features
- **Location-Based Search**: Search for leads within a specified radius of any city
- **Advanced Filtering**: Filter by industry categories, verification status, contact information availability
- **Real-time Map Visualization**: Interactive map showing lead locations with clustering
- **Lead Enrichment**: Watch leads being enriched in real-time with company information
- **Lead Scoring**: AI-powered quality scores (0-100) for lead prioritization
- **Multi-Status Tracking**: Track leads through DISCOVERED → ENRICHING → READY states

### UI Components
- **SearchPanel**: Collapsible search controls with expandable sections
- **LocationInput**: Autocomplete location search with suggestions
- **RadiusSlider**: Interactive slider for search radius adjustment
- **CategoryFilter**: Multi-select industry category filtering
- **QualityToggles**: Toggle filters for verified, phone, and website availability
- **MapPanel**: Interactive map with lead markers and clustering
- **LeadListPanel**: Sortable lead list with detail cards
- **LeadCard**: Rich card component showing lead info, score, and status
- **ScoreRing**: Circular progress indicator for lead quality score
- **StatusBadge**: Visual indicator for enrichment status

### Animations & Interactions
- **Page Load**: Smooth fade-in on page load
- **Slider Animations**: Real-time map updates on radius changes
- **Card Hover Effects**: Scale and glow effects on lead cards
- **Status Transitions**: Smooth color transitions (amber → emerald) for ready leads
- **Search Simulation**: 2-4 second search with enrichment progress
- **Marker Animations**: Spring-based marker entrance with hover scaling
- **Staggered Tabs**: Sequential animation of filter sections

## Design System

### Color Palette
- **Background**: #0A0A0F (Deep Navy)
- **Card/Secondary**: #141419, #1E1E28 (Layered Grays)
- **Primary/Accent**: #4F6EF7 (Electric Blue)
- **Success**: #10B981 (Emerald Green)
- **Warning**: #F59E0B (Amber)
- **Destructive**: #F23B22 (Red)
- **Foreground**: #E8E8EB (Off-White)

### Layout
**Desktop (1280px+)**
- 280px left sidebar (SearchPanel)
- Flex-grow center area (MapPanel)
- 360px right sidebar (LeadListPanel)
- Responsive collapse to icon rail

**Tablet (1024-1280px)**
- SearchPanel collapses to icon rail
- Bottom sheet for search controls
- Full-width map primary view

**Mobile (<1024px)**
- Full-width SearchPanel at top
- Full-width LeadListPanel below
- Bottom sheet overlay for map

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4 with custom design tokens
- **Animations**: Framer Motion 12
- **Form Controls**: Radix UI components
- **Icons**: Lucide React
- **Database**: Mock data (ready for integration)

## Project Structure

```
/components
  ├── app-shell.tsx           # Main layout component
  ├── search-panel.tsx        # Search controls
  ├── location-input.tsx      # Location search
  ├── radius-slider.tsx       # Radius selector
  ├── category-filter.tsx     # Industry filter
  ├── quality-toggles.tsx     # Quality filters
  ├── map-panel.tsx           # Map visualization
  ├── lead-list-panel.tsx     # Lead list
  ├── lead-card.tsx           # Individual lead card
  ├── score-ring.tsx          # Score visualization
  └── status-badge.tsx        # Status indicator

/lib
  ├── mock-data.ts            # 12 sample leads
  ├── animations.ts           # Animation variants
  └── utils.ts                # Utility functions

/app
  ├── page.tsx                # Home page
  ├── layout.tsx              # Root layout
  └── globals.css             # Global styles
```

## Getting Started

### Installation
```bash
pnpm install
pnpm dev
```

### Building for Production
```bash
pnpm build
pnpm start
```

## Mock Data

The application includes 12 sample leads with:
- Realistic company names and locations
- Industry categories (tech, saas, finance, healthcare, retail, ecommerce)
- Verification status
- Contact information (phone/website)
- Quality scores (61-93)
- Enrichment states (discovered, enriching, ready)

## Future Enhancements

- [ ] Database integration (Supabase/Neon)
- [ ] Real API endpoints for lead search
- [ ] User authentication
- [ ] Saved searches and favorites
- [ ] Export functionality (CSV/PDF)
- [ ] Advanced analytics dashboard
- [ ] Bulk lead operations
- [ ] Custom lead fields
- [ ] AI-powered lead recommendations
- [ ] Webhook integrations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- Optimized with Next.js Image component
- Server Components for better load times
- Lazy loading of components
- Efficient re-renders with React 19

## License

Copyright © 2024 LeadRadar. All rights reserved.
