'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, MapPin, Zap, Filter } from 'lucide-react';
import { LocationInput } from './location-input';
import { RadiusSlider } from './radius-slider';
import { CategoryFilter } from './category-filter';
import { QualityToggles } from './quality-toggles';

interface SearchParams {
  location: string;
  radius: number;
  categories: string[];
  minLeads: number;
  maxLeads: number;
  qualityFilters: {
    verified: boolean;
    phone: boolean;
    website: boolean;
  };
}

interface SearchPanelProps {
  params: SearchParams;
  onParamsChange: (params: SearchParams) => void;
  isMobile?: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSearch?: () => void;
}

export function SearchPanel({
  params,
  onParamsChange,
  isMobile,
  isCollapsed = false,
  onCollapsedChange,
  onSearch,
}: SearchPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('location');

  const handleLocationChange = (location: string) => {
    onParamsChange({ ...params, location });
  };

  const handleRadiusChange = (radius: number) => {
    onParamsChange({ ...params, radius });
  };

  const handleCategoriesChange = (categories: string[]) => {
    onParamsChange({ ...params, categories });
  };

  const handleQualityChange = (filters: SearchParams['qualityFilters']) => {
    onParamsChange({ ...params, qualityFilters: filters });
  };

  if (isMobile) {
    return (
      <motion.div
        initial={{ height: 'auto' }}
        animate={{ height: isCollapsed ? 'auto' : 'auto' }}
        className="p-4 bg-secondary"
      >
        <button
          onClick={() => onCollapsedChange?.(!isCollapsed)}
          className="w-full flex items-center justify-between py-2 px-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
        >
          <span className="flex items-center gap-2 text-foreground font-medium">
            <Filter className="w-4 h-4" />
            Filters
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-4"
          >
            <LocationInput value={params.location} onChange={handleLocationChange} />
            <RadiusSlider value={params.radius} onChange={handleRadiusChange} />
            <CategoryFilter selected={params.categories} onChange={handleCategoriesChange} />
            <QualityToggles filters={params.qualityFilters} onChange={handleQualityChange} />
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-secondary overflow-y-auto"
    >
      <div className="p-4 border-b border-border">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-foreground mb-1"
        >
          LeadRadar
        </motion.h1>
        <p className="text-sm text-muted-foreground">Find and enrich leads</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Location Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === 'location' ? null : 'location')}
              className="w-full flex items-center justify-between py-2 px-3 bg-card rounded-lg hover:bg-card/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-foreground font-medium">
                <MapPin className="w-4 h-4 text-primary" />
                Location
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSection === 'location' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'location' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <LocationInput value={params.location} onChange={handleLocationChange} />
                <RadiusSlider value={params.radius} onChange={handleRadiusChange} />
              </motion.div>
            )}
          </motion.div>

          {/* Categories Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === 'categories' ? null : 'categories')}
              className="w-full flex items-center justify-between py-2 px-3 bg-card rounded-lg hover:bg-card/80 transition-colors"
            >
              <span className="flex items-center gap-2 text-foreground font-medium">
                <Zap className="w-4 h-4 text-warning" />
                Categories
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSection === 'categories' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'categories' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <CategoryFilter selected={params.categories} onChange={handleCategoriesChange} />
              </motion.div>
            )}
          </motion.div>

          {/* Quality Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === 'quality' ? null : 'quality')}
              className="w-full flex items-center justify-between py-2 px-3 bg-card rounded-lg hover:bg-card/80 transition-colors"
            >
              <span className="flex items-center gap-2 text-foreground font-medium">
                <Filter className="w-4 h-4 text-success" />
                Quality
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSection === 'quality' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'quality' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <QualityToggles filters={params.qualityFilters} onChange={handleQualityChange} />
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSearch}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Search Leads
        </motion.button>
      </div>
    </motion.div>
  );
}
