'use client';

import { motion } from 'framer-motion';

interface CategoryFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const categories = [
    { id: 'retail', label: 'Retail', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'tech', label: 'Tech', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'finance', label: 'Finance', color: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'healthcare', label: 'Healthcare', color: 'bg-red-500/20 text-red-400' },
    { id: 'saas', label: 'SaaS', color: 'bg-cyan-500/20 text-cyan-400' },
    { id: 'ecommerce', label: 'E-commerce', color: 'bg-orange-500/20 text-orange-400' },
  ];

  const toggleCategory = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground block">Industry</label>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category, index) => {
          const isSelected = selected.includes(category.id);
          return (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => toggleCategory(category.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? `${category.color} ring-2 ring-offset-2 ring-offset-background border border-primary/50`
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {category.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
