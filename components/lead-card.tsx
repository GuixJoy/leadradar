'use client';

import { motion } from 'framer-motion';
import { MapPin, Phone, Globe, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { ScoreRing } from './score-ring';
import { StatusBadge } from './status-badge';

export interface Lead {
  id: string;
  name: string;
  category: string;
  location: string;
  phone?: string;
  website?: string;
  verified: boolean;
  score: number;
  status: 'discovered' | 'enriching' | 'ready';
  discovered: string;
}

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onSelect: () => void;
}

export function LeadCard({ lead, isSelected, onSelect }: LeadCardProps) {
  const statusColors = {
    discovered: '#4F6EF7',
    enriching: '#F59E0B',
    ready: '#10B981',
  };

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left transition-all rounded-lg border-2 overflow-hidden ${
        isSelected
          ? 'border-primary bg-primary/10 shadow-lg'
          : 'border-border bg-card hover:border-primary/50 hover:bg-card/80'
      }`}
    >
      <div className="p-3 space-y-2">
        {/* Header with score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-sm">
              {lead.name}
            </h3>
            <p className="text-xs text-muted-foreground">{lead.category}</p>
          </div>
          <ScoreRing score={lead.score} size="sm" />
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{lead.location}</span>
        </div>

        {/* Contact info */}
        {(lead.phone || lead.website) && (
          <div className="flex gap-2 flex-wrap">
            {lead.phone && (
              <motion.a
                whileHover={{ scale: 1.05 }}
                href={`tel:${lead.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
              >
                <Phone className="w-3 h-3" />
                Call
              </motion.a>
            )}
            {lead.website && (
              <motion.a
                whileHover={{ scale: 1.05 }}
                href={lead.website}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
              >
                <Globe className="w-3 h-3" />
                Website
              </motion.a>
            )}
          </div>
        )}

        {/* Status and badges */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={lead.status} />
            {lead.verified && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/20 text-success text-xs font-medium"
              >
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            {lead.status === 'enriching' ? (
              <>
                <Sparkles className="w-3 h-3 text-warning animate-pulse" />
                Enriching
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                {new Date(lead.discovered).toLocaleDateString()}
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Selection highlight */}
      {isSelected && (
        <motion.div
          layoutId="cardGlow"
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            boxShadow: `inset 0 0 12px rgba(79, 110, 247, 0.2)`,
          }}
        />
      )}
    </motion.button>
  );
}
