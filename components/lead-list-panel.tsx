'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp } from 'lucide-react';
import { LeadCard } from './lead-card';
import { MOCK_LEADS } from '@/lib/mock-data';

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

interface LeadListPanelProps {
  searchParams: SearchParams;
  selectedLead: string | null;
  onSelectLead: (leadId: string | null) => void;
  isSearching?: boolean;
}

export function LeadListPanel({
  searchParams,
  selectedLead,
  onSelectLead,
  isSearching = false,
}: LeadListPanelProps) {
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score');

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let leads = [...MOCK_LEADS];

    // Apply quality filters
    if (searchParams.qualityFilters.verified) {
      leads = leads.filter((lead) => lead.verified);
    }
    if (searchParams.qualityFilters.phone) {
      leads = leads.filter((lead) => lead.phone);
    }
    if (searchParams.qualityFilters.website) {
      leads = leads.filter((lead) => lead.website);
    }

    // Apply category filters
    if (searchParams.categories.length > 0) {
      leads = leads.filter((lead) =>
        searchParams.categories.includes(lead.category)
      );
    }

    // Sort
    if (sortBy === 'score') {
      leads.sort((a, b) => b.score - a.score);
    } else {
      leads.sort((a, b) => new Date(b.discovered).getTime() - new Date(a.discovered).getTime());
    }

    return leads;
  }, [searchParams, sortBy]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-background"
    >
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <motion.h2
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-lg font-bold text-foreground flex items-center gap-2"
        >
          <TrendingUp className="w-5 h-5 text-primary" />
          Leads
        </motion.h2>

        {/* Search Input */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2"
        >
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Filter leads..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm"
          />
        </motion.div>

        {/* Sort Controls */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2"
        >
          <button
            onClick={() => setSortBy('score')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'score'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Top Rated
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'recent'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Recent
          </button>
        </motion.div>

        {/* Results info */}
        <p className="text-xs text-muted-foreground">
          {isSearching ? 'Searching...' : `${filteredLeads.length} leads found`}
        </p>
      </div>

      {/* Leads List */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
            <p className="text-sm text-muted-foreground">Searching for leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
            <Search className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No leads found</p>
            <p className="text-xs text-muted-foreground/70">Try adjusting your filters</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 space-y-2"
          >
            {filteredLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <LeadCard
                  lead={lead}
                  isSelected={selectedLead === lead.id}
                  onSelect={() => onSelectLead(selectedLead === lead.id ? null : lead.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
