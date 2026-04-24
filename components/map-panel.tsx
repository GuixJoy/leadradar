'use client';

import { motion } from 'framer-motion';
import { MapPin, AlertCircle } from 'lucide-react';

interface MapPanelProps {
  location: string;
}

export function MapPanel({ location }: MapPanelProps) {
  // SVG map background simulation with markers
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const markerVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      },
    },
    hover: {
      scale: 1.2,
      transition: { duration: 0.2 },
    },
  };

  // Mock marker positions (relative to container)
  const markers = [
    { id: 1, x: '25%', y: '30%', status: 'ready' },
    { id: 2, x: '45%', y: '40%', status: 'enriching' },
    { id: 3, x: '65%', y: '35%', status: 'ready' },
    { id: 4, x: '35%', y: '55%', status: 'discovered' },
    { id: 5, x: '50%', y: '65%', status: 'ready' },
    { id: 6, x: '70%', y: '60%', status: 'enriching' },
    { id: 7, x: '20%', y: '70%', status: 'ready' },
    { id: 8, x: '75%', y: '45%', status: 'discovered' },
  ];

  const statusColors = {
    ready: '#10B981',
    enriching: '#F59E0B',
    discovered: '#4F6EF7',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex flex-col bg-gradient-to-br from-background to-secondary relative overflow-hidden"
    >
      {/* Map Header */}
      <div className="px-6 py-4 border-b border-border bg-secondary/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {location}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">8 leads found</p>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Ready (4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Enriching (2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-info" />
              <span className="text-muted-foreground">Discovered (2)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background map simulation */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/30 to-background" />

        {/* Grid overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Markers */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="absolute inset-0"
        >
          {markers.map((marker) => (
            <motion.div
              key={marker.id}
              variants={markerVariants}
              whileHover="hover"
              style={{ left: marker.x, top: marker.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            >
              {/* Glow effect */}
              <div
                className="absolute inset-0 rounded-full blur-lg opacity-50 -inset-2"
                style={{
                  backgroundColor: statusColors[marker.status as keyof typeof statusColors],
                }}
              />

              {/* Marker */}
              <div
                className="relative w-6 h-6 rounded-full border-2 border-background shadow-lg flex items-center justify-center"
                style={{
                  backgroundColor: statusColors[marker.status as keyof typeof statusColors],
                }}
              >
                <div className="w-2 h-2 bg-background rounded-full" />
              </div>

              {/* Tooltip */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileHover={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground whitespace-nowrap z-10 pointer-events-none"
              >
                Lead #{marker.id}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Center crosshair */}
        <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-0 h-0">
            <div className="absolute -left-3 -top-3 w-6 h-6 border-2 border-primary/30 rounded-full" />
            <div className="absolute -left-0.5 -top-3 w-1 h-6 bg-primary/30" />
            <div className="absolute -left-3 -top-0.5 h-1 w-6 bg-primary/30" />
          </div>
        </div>
      </div>

      {/* Map Footer Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="px-6 py-3 border-t border-border bg-secondary/50 backdrop-blur-sm flex items-center gap-2 text-sm text-muted-foreground"
      >
        <AlertCircle className="w-4 h-4" />
        Markers indicate lead locations within your search radius
      </motion.div>
    </motion.div>
  );
}
