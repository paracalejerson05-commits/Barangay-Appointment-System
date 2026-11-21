import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { parseToDate } from './utils';

export type ServiceRequestTrendPeriod = 'week' | 'month';

export function getServiceRequestTrend(
  requests: any[],
  period: ServiceRequestTrendPeriod,
  referenceDate = new Date()
) {
  const today = startOfDay(referenceDate);
  const startDate = period === 'week' ? startOfWeek(today, { weekStartsOn: 0 }) : startOfMonth(today);
  const numberOfDays = differenceInCalendarDays(today, startDate) + 1;
  const trendData = Array.from({ length: numberOfDays }, (_, index) => {
    const date = addDays(startDate, index);
    const dayRequests = requests.filter(request => {
      const requestDate = parseToDate(request.createdAt);
      return requestDate ? isSameDay(requestDate, date) : false;
    });
    const getStatusCount = (status: string) =>
      dayRequests.filter(request => String(request.status ?? '').trim().toLowerCase() === status).length;

    return {
      name: format(date, period === 'week' ? 'MMM dd' : 'd'),
      Total: dayRequests.length,
      Approved: getStatusCount('approved'),
      Completed: getStatusCount('completed'),
      Pending: getStatusCount('pending'),
      Disapproved: getStatusCount('disapproved')
    };
  });

  const startLabel = format(startDate, startDate.getFullYear() === today.getFullYear() ? 'MMM d' : 'MMM d, yyyy');
  const rangeLabel = `${startLabel} - ${format(today, 'MMM d, yyyy')}`;
  return {
    data: trendData,
    description: `${period === 'week' ? 'Week' : 'Month'} to date · ${rangeLabel}`
  };
}
