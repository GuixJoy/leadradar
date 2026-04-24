'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: 'discovered' | 'enriching' | 'ready';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    discovered: {
      label: 'Discovered',
      icon: Clock,
      bgColor: 'bg-info/20',
      textColor: 'text-info',
      borderColor: 'border-info/50',
    },
    enriching: {
      label: 'Enriching',
      icon: Sparkles,
      bgColor: 'bg-warning/20',
      textColor: 'text-warning',
      borderColor: 'border-warning/50',
    },
    ready: {
      label: 'Ready',
      icon: CheckCircle2,
      bgColor: 'bg-success/20',
      textColor: 'text-success',
      borderColor: 'border-success/50',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${config.bgColor} ${config.textColor} border-current/50 text-xs font-medium`}
    >
      <motion.div
        animate={status === 'enriching' ? { rotate: 360 } : {}}
        transition={status === 'enriching' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
      >
        <Icon className="w-3 h-3" />
      </motion.div>
      {config.label}
    </motion.div>
  );
}
