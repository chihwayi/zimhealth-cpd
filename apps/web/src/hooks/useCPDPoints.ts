import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CPDSummary {
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  cycleYear: number;
  recordCount: number;
}

export function useCPDPoints(year?: number) {
  return useQuery<CPDSummary>({
    queryKey: ['cpd-summary', year],
    queryFn: () => api.get(`/api/points/summary${year ? `?year=${year}` : ''}`),
  });
}

