import { Award, BookOpen, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useCPDPoints } from '../../hooks/useCPDPoints';
import { StatCard } from '../../components/ui/StatCard';
import { ProgressRing } from '../../components/ui/ProgressRing';

export default function LearnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: cpd, isLoading } = useCPDPoints();

  const renewalDeadline = new Date(new Date().getFullYear(), 11, 31); // Dec 31
  const daysLeft = Math.ceil((renewalDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysLeft <= 60;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {user?.fullName.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-ZW', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Stats + Progress Ring */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* CPD Ring — spans 1 col */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center gap-3">
          {isLoading ? (
            <div className="w-40 h-40 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <ProgressRing
              value={cpd?.percentComplete ?? 0}
              label={`${cpd?.totalPoints ?? 0}`}
              sublabel={`/ ${cpd?.requiredPoints ?? 12} pts`}
              color={isUrgent ? '#f59e0b' : '#14b8a6'}
            />
          )}
          <p className="text-sm font-medium text-slate-600">
            {cpd?.percentComplete === 100 ? 'CPD Complete' : 'CPD Progress'}
          </p>
        </div>

        {/* 3 stat cards */}
        <StatCard
          title="Points Earned"
          value={isLoading ? '–' : `${cpd?.totalPoints ?? 0}`}
          subtitle={`of ${cpd?.requiredPoints ?? 12} required`}
          icon={<Award size={20} />}
          accent="teal"
        />
        <StatCard
          title="Points Needed"
          value={isLoading ? '–' : Math.max(0, (cpd?.requiredPoints ?? 12) - (cpd?.totalPoints ?? 0))}
          subtitle="to complete renewal"
          icon={<BookOpen size={20} />}
          accent="amber"
        />
        <StatCard
          title="Days to Renewal"
          value={daysLeft}
          subtitle={`Deadline: ${renewalDeadline.toLocaleDateString('en-ZW')}`}
          icon={<Calendar size={20} />}
          accent={isUrgent ? 'red' : 'green'}
        />
      </div>

      {/* Placeholder for in-progress courses — Sprint 09 builds CourseCard */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Continue Learning</h2>
        <p className="text-slate-400 text-sm">
          Enrol in a course to see it here.{' '}
          <a href="/courses" className="text-primary-600 hover:underline">
            Browse courses →
          </a>
        </p>
      </div>

      {/* WhatsApp shortcut */}
      <div className="bg-[#f0fdf4] border border-green-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.098.544 4.071 1.494 5.785L.057 24l6.347-1.664A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.368l-.359-.213-3.72.976.993-3.63-.234-.372A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm">Learn on WhatsApp</p>
          <p className="text-slate-500 text-xs mt-0.5">
            No app needed. Get micro-lessons and earn CPD points via WhatsApp.
          </p>
        </div>
        <a
          href="https://wa.me/263771234567"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex-shrink-0 bg-[#25D366] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#20ba5a] transition-colors"
        >
          Start now →
        </a>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

