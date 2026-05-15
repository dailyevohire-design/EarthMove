'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MissionRow {
  meals_committed_total: number;
  meals_goal: number;
}

interface Props {
  initial: MissionRow;
}

export function MissionCounterLive({ initial }: Props) {
  const [meals, setMeals] = useState(initial.meals_committed_total);
  const [animating, setAnimating] = useState(false);
  const lastRef = useRef(initial.meals_committed_total);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('mission_progress_feeding_america')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mission_progress',
          filter: 'id=eq.feeding_america_2026',
        },
        (payload) => {
          const next = (payload.new as MissionRow).meals_committed_total;
          if (next > lastRef.current) {
            setAnimating(true);
            setMeals(next);
            lastRef.current = next;
            setTimeout(() => setAnimating(false), 1400);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const pct = Math.min(100, (meals / initial.meals_goal) * 100);

  return (
    <div className="rounded-xl bg-[#0E2A22] text-[#F5F1E8] p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest opacity-70">
          Meals Committed via Feeding America&reg;
        </span>
        <span className="text-xs opacity-70">{pct.toFixed(1)}% to goal</span>
      </div>
      <div
        className={`text-5xl font-medium mt-2 transition-all duration-700 ${
          animating ? 'scale-110 text-emerald-300' : ''
        }`}
      >
        {meals.toLocaleString()}
      </div>
      <div className="text-xs opacity-70 mt-1">of {initial.meals_goal.toLocaleString()}</div>
      <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs opacity-60 mt-4">
        * $1 helps provide at least 10 meals secured by Feeding America&reg; on behalf of local
        partner food banks.
      </p>
    </div>
  );
}
