'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SearchPanel } from './search-panel';
import { MapPanel } from './map-panel';
import { LeadListPanel } from './lead-list-panel';

export function AppShell() {
  const [searchParams, setSearchParams] = useState({
    location: 'San Francisco, CA',
    radius: 5,
    categories: [] as string[],
    minLeads: 0,
    maxLeads: 100,
    qualityFilters: {
      verified: false,
      phone: false,
      website: false,
    },
  });

  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="h-screen w-full bg-background flex flex-col lg:flex-row overflow-hidden"
    >
      {/* Search Panel - Collapsible on larger screens */}
      <motion.div
        initial={{ x: 0 }}
        className="hidden lg:flex lg:w-72 lg:flex-shrink-0 bg-secondary border-r border-border flex-col"
      >
        <SearchPanel 
          params={searchParams} 
          onParamsChange={setSearchParams}
          isCollapsed={isSearchCollapsed}
          onCollapsedChange={setIsSearchCollapsed}
          onSearch={() => {
            setIsSearching(true);
            setTimeout(() => setIsSearching(false), 2000);
          }}
        />
      </motion.div>

      {/* Mobile Search Panel */}
      <div className="lg:hidden w-full bg-secondary border-b border-border">
        <SearchPanel 
          params={searchParams} 
          onParamsChange={setSearchParams}
          isMobile
          isCollapsed={isSearchCollapsed}
          onCollapsedChange={setIsSearchCollapsed}
          onSearch={() => {
            setIsSearching(true);
            setTimeout(() => setIsSearching(false), 2000);
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col-reverse lg:flex-row gap-0 overflow-hidden">
        {/* Map Panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex flex-1 bg-background"
        >
          <MapPanel location={searchParams.location} />
        </motion.div>

        {/* Lead List Panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 lg:w-96 lg:flex-shrink-0 bg-background flex flex-col border-l border-border overflow-hidden"
        >
        <LeadListPanel 
          searchParams={searchParams}
          selectedLead={selectedLead}
          onSelectLead={setSelectedLead}
          isSearching={isSearching}
        />
        </motion.div>
      </div>

      {/* Mobile Map Toggle */}
      {isMobileMapOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="fixed inset-0 lg:hidden bg-background z-40"
        >
          <button
            onClick={() => setIsMobileMapOpen(false)}
            className="absolute top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg"
          >
            Close Map
          </button>
          <MapPanel location={searchParams.location} />
        </motion.div>
      )}
    </motion.div>
  );
}
