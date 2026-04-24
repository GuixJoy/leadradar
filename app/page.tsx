'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, MapPin, Zap, Filter, Search, Phone, Globe, CheckCircle } from 'lucide-react';

// Mock data
const mockLeads = [
  { id: 1, company: 'TechFlow Inc', city: 'San Francisco', status: 'ready', score: 95, verified: true, phone: true, website: true },
  { id: 2, company: 'DataCore Solutions', city: 'San Francisco', status: 'enriching', score: 87, verified: true, phone: true, website: false },
  { id: 3, company: 'CloudNext Enterprises', city: 'San Jose', status: 'ready', score: 92, verified: true, phone: false, website: true },
  { id: 4, company: 'InnovateLabs', city: 'Oakland', status: 'discovered', score: 78, verified: false, phone: true, website: true },
  { id: 5, company: 'FutureScale Systems', city: 'San Mateo', status: 'ready', score: 91, verified: true, phone: true, website: true },
  { id: 6, company: 'NexGen Analytics', city: 'Mountain View', status: 'enriching', score: 85, verified: true, phone: false, website: true },
  { id: 7, company: 'SmartOps Platform', city: 'Palo Alto', status: 'ready', score: 93, verified: true, phone: true, website: true },
  { id: 8, company: 'VentureTech Group', city: 'Sunnyvale', status: 'discovered', score: 82, verified: false, phone: true, website: false },
  { id: 9, company: 'DigitalSync Corp', city: 'San Francisco', status: 'ready', score: 96, verified: true, phone: true, website: true },
  { id: 10, company: 'CloudPeak Industries', city: 'Fremont', status: 'enriching', score: 88, verified: true, phone: true, website: true },
];

export default function Home() {
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [radius, setRadius] = useState(5);
  const [location, setLocation] = useState('San Francisco, CA');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return '#10B981';
      case 'enriching': return '#F59E0B';
      case 'discovered': return '#4F6EF7';
      default: return '#A0A0AB';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="h-screen w-full bg-background flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: '#0A0A0F', color: '#E8E8EB' }}
    >
      {/* Left Panel - Search Controls */}
      <motion.div
        className="hidden lg:flex lg:w-72 lg:flex-shrink-0 flex-col border-r"
        style={{ borderColor: '#2D2D3A', backgroundColor: '#141419' }}
      >
        <div className="p-4 border-b" style={{ borderColor: '#2D2D3A' }}>
          <h1 className="text-xl font-bold" style={{ color: '#4F6EF7' }}>LeadRadar</h1>
          <p className="text-xs mt-1" style={{ color: '#A0A0AB' }}>Find & Enrich Business Leads</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Location Input */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: '#E8E8EB' }}>Location</label>
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: '#1E1E28', borderColor: '#2D2D3A' }}>
              <MapPin className="w-4 h-4" style={{ color: '#4F6EF7' }} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#E8E8EB' }}
              />
            </div>
          </div>

          {/* Radius Slider */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: '#E8E8EB' }}>
              Radius: <span style={{ color: '#4F6EF7' }}>{radius} miles</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: '#E8E8EB' }}>Categories</label>
            <div className="space-y-2">
              {['Technology', 'Finance', 'E-commerce', 'Healthcare'].map((cat) => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: '#A0A0AB' }}>{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quality Filters */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: '#E8E8EB' }}>Quality</label>
            <div className="space-y-2">
              {['Verified Only', 'Has Phone', 'Has Website'].map((filter) => (
                <label key={filter} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: '#A0A0AB' }}>{filter}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: '#2D2D3A' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSearch}
            className="w-full py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: '#4F6EF7', color: '#0A0A0F' }}
          >
            {isSearching ? 'Searching...' : 'Search Leads'}
          </motion.button>
        </div>
      </motion.div>

      {/* Middle Panel - Map */}
      <motion.div
        className="hidden lg:flex lg:flex-1 flex-col relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="px-6 py-4 border-b" style={{ backgroundColor: '#141419', borderColor: '#2D2D3A' }}>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: '#E8E8EB' }}>
            <MapPin className="w-5 h-5" style={{ color: '#4F6EF7' }} />
            {location}
          </h2>
          <p className="text-sm mt-1" style={{ color: '#A0A0AB' }}>{mockLeads.length} leads found</p>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0" style={{ backgroundColor: '#1E1E28' }} />
          
          {/* Simple map grid */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Map markers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
            className="absolute inset-0"
          >
            {mockLeads.map((lead, idx) => (
              <motion.div
                key={lead.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{
                  left: `${20 + (idx % 5) * 15}%`,
                  top: `${30 + Math.floor(idx / 5) * 25}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                onMouseEnter={() => setSelectedLead(lead.id)}
                onMouseLeave={() => setSelectedLead(null)}
              >
                <motion.div
                  whileHover={{ scale: 1.2 }}
                  className="relative w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  style={{
                    backgroundColor: getStatusColor(lead.status),
                    borderColor: '#0A0A0F',
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0A0A0F' }} />
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Lead List */}
      <motion.div
        className="flex-1 lg:w-96 flex-shrink-0 flex flex-col border-l"
        style={{ borderColor: '#2D2D3A', backgroundColor: '#0A0A0F' }}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: '#2D2D3A' }}>
          <h3 className="text-lg font-bold" style={{ color: '#E8E8EB' }}>Leads</h3>
          <p className="text-sm mt-1" style={{ color: '#A0A0AB' }}>Sort by Score</p>
        </div>

        {isSearching && (
          <div className="px-6 py-8 flex flex-col items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2"
              style={{ borderColor: '#4F6EF7', borderTopColor: 'transparent' }}
            />
            <p className="text-sm mt-4" style={{ color: '#A0A0AB' }}>Enriching leads...</p>
          </motion.div>
        )}

        {!isSearching && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mockLeads.map((lead) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedLead(lead.id)}
                className="p-4 rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: selectedLead === lead.id ? '#141419' : '#1E1E28',
                  borderLeft: `4px solid ${getStatusColor(lead.status)}`,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: '#E8E8EB' }}>{lead.company}</h4>
                    <p className="text-xs mt-1" style={{ color: '#A0A0AB' }}>{lead.city}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getStatusColor(lead.status), color: '#0A0A0F' }}
                    >
                      {lead.score}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {lead.verified && (
                    <div className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: '#10B98155', color: '#10B981' }}>
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </div>
                  )}
                  {lead.phone && (
                    <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F59E0B55', color: '#F59E0B' }}>
                      Phone
                    </div>
                  )}
                  {lead.website && (
                    <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#4F6EF755', color: '#4F6EF7' }}>
                      Website
                    </div>
                  )}
                </div>

                <div className="text-xs mt-3 px-2 py-1 rounded w-fit" style={{ backgroundColor: '#2D2D3A', color: '#E8E8EB' }}>
                  {getStatusLabel(lead.status)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
