import { HealthCheckCard } from '@/components/health-check/health-check-card';
import { leadHealthResults, type LeadHealthCheckInput } from '@/lib/lead-health-check';

export function LeadHealthCheckCard(props: LeadHealthCheckInput) {
  const results = leadHealthResults(props);
  return <HealthCheckCard
    results={results}
    emptyMessage={`No checks apply to ${props.status} leads. Checks run for New and Working Lead statuses.`}
  />;
}
