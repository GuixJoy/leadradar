'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-warning" />
          Radius
        </label>
        <motion.span
          key={value}
          initial={{ scale: 1.2, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-sm font-semibold text-primary"
        >
          {value} mi
        </motion.span>
      </div>

      <Slider.Root
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={0}
        max={50}
        step={1}
        className="relative flex items-center h-5 w-full touch-none select-none"
      >
        <Slider.Track className="relative h-1 flex-grow rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(value / 50) * 100}%` }}
            className="absolute h-full bg-gradient-to-r from-primary to-primary rounded-full"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </Slider.Track>
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-lg hover:shadow-xl transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer" />
      </Slider.Root>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0 mi</span>
        <span>50 mi</span>
      </div>
    </div>
  );
}
