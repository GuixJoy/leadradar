'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Phone, Globe } from 'lucide-react';

interface QualityTogglesProps {
  filters: {
    verified: boolean;
    phone: boolean;
    website: boolean;
  };
  onChange: (filters: QualityTogglesProps['filters']) => void;
}

export function QualityToggles({ filters, onChange }: QualityTogglesProps) {
  const toggles = [
    {
      id: 'verified',
      label: 'Verified Only',
      icon: CheckCircle2,
      description: 'Verified businesses',
    },
    {
      id: 'phone',
      label: 'Has Phone',
      icon: Phone,
      description: 'Contact number on file',
    },
    {
      id: 'website',
      label: 'Has Website',
      icon: Globe,
      description: 'Website available',
    },
  ];

  const toggle = (id: keyof typeof filters) => {
    onChange({ ...filters, [id]: !filters[id] });
  };

  return (
    <div className="space-y-2">
      {toggles.map((item, index) => {
        const Icon = item.icon;
        const isActive = filters[item.id as keyof typeof filters];

        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => toggle(item.id as keyof typeof filters)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
              isActive
                ? 'bg-success/20 text-success border border-success/50'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs opacity-70">{item.description}</div>
            </div>
            {isActive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2 h-2 rounded-full bg-success"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
