import { useQuery } from '@tanstack/react-query';
import { Flame, Lock, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';

interface StreakResponse {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

interface AchievementItem {
  code: string;
  title: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
}

interface AchievementsResponse {
  achievements: AchievementItem[];
}

export function EngagementCard() {
  const streakQuery = useQuery<StreakResponse>({
    queryKey: ['learner-streak'],
    queryFn: () => api.get('/api/learners/me/streak'),
  });
  const achievementsQuery = useQuery<AchievementsResponse>({
    queryKey: ['learner-achievements'],
    queryFn: () => api.get('/api/learners/me/achievements'),
  });

  const streak = streakQuery.data;
  const achievements = achievementsQuery.data?.achievements ?? [];
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Your Progress</h2>
        {achievements.length > 0 && (
          <span className="text-xs font-semibold text-slate-500">
            {earnedCount}/{achievements.length} badges
          </span>
        )}
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* Streak */}
        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Flame size={22} className="text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
              {streakQuery.isLoading ? '–' : streak?.currentStreak ?? 0}
              <span className="text-sm font-semibold text-slate-500 ml-1.5">day streak</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Longest: {streak?.longestStreak ?? 0} day{(streak?.longestStreak ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Achievements */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Badges</p>
          {achievementsQuery.isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {achievements.map((a) => (
                <div
                  key={a.code}
                  title={a.description}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
                    a.earned
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200 opacity-60',
                  )}
                >
                  {a.earned ? (
                    <Trophy size={18} className="text-amber-600" />
                  ) : (
                    <Lock size={16} className="text-slate-400" />
                  )}
                  <p className={clsx('text-[11px] font-semibold leading-tight', a.earned ? 'text-amber-900' : 'text-slate-500')}>
                    {a.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
