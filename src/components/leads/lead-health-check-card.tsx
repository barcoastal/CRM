import { HealthCheckCard } from '@/components/health-check/health-check-card';
import { leadHealthResults, type LeadHealthCheckInput } from '@/lib/lead-health-check';

export function LeadHealthCheckCard(props: LeadHealthCheckInput) {
  const results = leadHealthResults(props);
  return results.length ? <HealthCheckCard results={results} /> : null;
}
