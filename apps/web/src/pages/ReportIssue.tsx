import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

export default function ReportIssue() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: () => api.post('/api/issues', { title, description, source: 'WEB' }),
    onSuccess: () => {
      setSubmitted(true);
      setTitle('');
      setDescription('');
    },
    onError: () => toast.error('Could not submit your report. Please try again.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || description.trim().length < 5) {
      toast.error('Please add a short title and a description of the issue.');
      return;
    }
    submitMutation.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Report an issue</h1>
          <p className="text-sm text-slate-500">Tell us what went wrong — our support team reviews every report.</p>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-900">Thanks — your report has been logged.</p>
            <p className="text-sm text-emerald-800 mt-1">Our support team will follow up if we need more details.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              Report another issue
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-slate-200 p-6">
          <div>
            <label htmlFor="issue-title" className="block text-sm font-semibold text-slate-900 mb-1.5">
              What's the issue? (short summary)
            </label>
            <input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quiz won't submit on the last question"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div>
            <label htmlFor="issue-description" className="block text-sm font-semibold text-slate-900 mb-1.5">
              Describe what happened
            </label>
            <textarea
              id="issue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What were you trying to do? What happened instead? Include the course/page name if relevant."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full rounded-xl bg-slate-950 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit report'}
          </button>
        </form>
      )}
    </div>
  );
}
