import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { SYSTEM_NAME } from '../constants';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseToDate } from '../lib/utils';
import { useLoadingActions } from '../hooks/useLoadingActions';
import { apiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  calculateServiceProcessingPerformance,
  formatProcessingDuration,
  getPaperUsageAnalytics,
  getPhilippinesYearMonth,
  REPORT_MONTHS,
  type PaperUsageRecord
} from '../lib/reportAnalytics';

function formatReportDate(value: unknown, includeTime = false): string {
  const date = parseToDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {})
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return includeTime ? `${day} ${part('hour')}:${part('minute')}` : day;
}

export function AdminReports({ requests, residents }: { requests: any[], residents: any[] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [exportError, setExportError] = useState('');
  const [paperRecords, setPaperRecords] = useState<PaperUsageRecord[]>([]);
  const [paperUsageLoading, setPaperUsageLoading] = useState(true);
  const [paperUsageError, setPaperUsageError] = useState('');
  const [paperUsagePeriod, setPaperUsagePeriod] = useState('');
  const { isLoading, startLoading, stopLoading } = useLoadingActions();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const months = REPORT_MONTHS;
  const selectedPeriodKey = `${selectedYear}:${selectedMonth}`;
  const paperUsageIsCurrent = paperUsagePeriod === selectedPeriodKey;
  const reportYears = useMemo(() => Array.from(new Set([
    String(new Date().getFullYear()),
    selectedYear,
    ...requests.map(request => getPhilippinesYearMonth(request.createdAt)?.year.toString()).filter((year): year is string => Boolean(year))
  ])).sort((a, b) => Number(b) - Number(a)), [requests, selectedYear]);

  useEffect(() => {
    let active = true;
    const periodKey = `${selectedYear}:${selectedMonth}`;
    setPaperRecords([]);
    setPaperUsageError('');
    setPaperUsageLoading(true);

    const loadPaperUsage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Your administrator session has expired.');
        const month = selectedMonth === 'All' ? 'All' : String(months.indexOf(selectedMonth) + 1);
        const query = new URLSearchParams({ year: selectedYear, month });
        const response = await fetch(apiUrl(`/api/admin/reports/paper-usage?${query}`), {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.records)) {
          throw new Error(result.error || `Paper usage could not be loaded (HTTP ${response.status}).`);
        }
        if (active) {
          setPaperRecords(result.records);
          setPaperUsagePeriod(periodKey);
        }
      } catch (error) {
        console.error('[Admin Reports] Could not load paper usage:', error);
        if (active) {
          setPaperUsageError(error instanceof Error ? error.message : 'Paper usage could not be loaded.');
          setPaperUsagePeriod(periodKey);
        }
      } finally {
        if (active) setPaperUsageLoading(false);
      }
    };

    void loadPaperUsage();
    return () => { active = false; };
  }, [selectedYear, selectedMonth]);

  // Centralized Data Processing
  const processedData = useMemo(() => {
    // 1. Filter requests by selected year
    const yearFiltered = requests.filter(req => {
      const date = getPhilippinesYearMonth(req.createdAt);
      return date ? date.year.toString() === selectedYear : false;
    });

    // 2. Further filter by month if selected
    const finalFiltered = selectedMonth === 'All' 
      ? yearFiltered 
      : yearFiltered.filter(req => {
          const date = getPhilippinesYearMonth(req.createdAt);
          return date ? months[date.month - 1] === selectedMonth : false;
        });

    // 3. Calculate Summary Stats
    const totalRequests = finalFiltered.length;
    const uniqueResidents = new Set(finalFiltered.map(r => r.residentUid)).size;
    const normalizedStatus = (request: any) => String(request.status || '').toLowerCase();
    const statusSummary = {
      completed: finalFiltered.filter(r => normalizedStatus(r) === 'completed').length,
      pending: finalFiltered.filter(r => normalizedStatus(r) === 'pending').length,
      approved: finalFiltered.filter(r => normalizedStatus(r) === 'approved').length,
      disapproved: finalFiltered.filter(r => normalizedStatus(r) === 'disapproved').length
    };
    // 4. Monthly Performance Trends
    const monthlyTrends = months.map((m, idx) => {
      const monthRequests = yearFiltered.filter(req => {
        const date = getPhilippinesYearMonth(req.createdAt);
        return date ? date.month === idx + 1 : false;
      });
      
      return {
        month: m,
        requests: monthRequests.length,
        completed: monthRequests.filter(r => normalizedStatus(r) === 'completed').length,
        pending: monthRequests.filter(r => normalizedStatus(r) === 'pending').length,
        approved: monthRequests.filter(r => normalizedStatus(r) === 'approved').length,
        disapproved: monthRequests.filter(r => normalizedStatus(r) === 'disapproved').length
      };
    });

    // 5. Service Breakdown
    const serviceGroups: Record<string, number> = {};
    finalFiltered.forEach(req => {
      const type = req.serviceType || 'Other';
      serviceGroups[type] = (serviceGroups[type] || 0) + 1;
    });
    const requestsByService = Object.entries(serviceGroups)
      .map(([service, count]) => ({ service, requests: count }))
      .sort((a, b) => b.requests - a.requests || a.service.localeCompare(b.service));
    return {
      finalFiltered,
      totalRequests,
      uniqueResidents,
      statusSummary,
      monthlyTrends,
      requestsByService,
      mostRequestedService: requestsByService[0] || null
    };
  }, [requests, selectedYear, selectedMonth]);

  const processingPerformance = useMemo(
    () => calculateServiceProcessingPerformance(processedData.finalFiltered),
    [processedData.finalFiltered]
  );
  const paperAnalytics = useMemo(() => getPaperUsageAnalytics(paperRecords), [paperRecords]);
  const paperByMonth = useMemo(
    () => new Map(paperAnalytics.monthly.map(data => [data.month, data])),
    [paperAnalytics.monthly]
  );

  const filteredMonthlyData = selectedMonth === 'All' 
    ? processedData.monthlyTrends 
    : processedData.monthlyTrends.filter(d => d.month === selectedMonth);
  const filteredPaperMonthlyData = selectedMonth === 'All'
    ? paperAnalytics.monthly
    : paperAnalytics.monthly.filter(data => data.month === selectedMonth);
  const highestMonthlyRequestCount = Math.max(
    ...filteredMonthlyData.map(data => data.requests),
    0
  );
  const statusDistribution = useMemo(() => {
    const statuses = [
      { name: 'Pending', key: 'pending', color: '#F59E0B' },
      { name: 'Approved', key: 'approved', color: '#2563EB' },
      { name: 'Completed', key: 'completed', color: '#10B981' },
      { name: 'Disapproved', key: 'disapproved', color: '#EF4444' }
    ].map(status => ({
      ...status,
      value: processedData.finalFiltered.filter(
        request => request.status?.toLowerCase() === status.key
      ).length
    }));
    const knownStatusTotal = statuses.reduce((total, status) => total + status.value, 0);
    if (knownStatusTotal < processedData.totalRequests) {
      statuses.push({
        name: 'Other',
        key: 'other',
        color: '#94A3B8',
        value: processedData.totalRequests - knownStatusTotal
      });
    }
    return statuses;
  }, [processedData.finalFiltered, processedData.totalRequests]);
  const getMonthlyTotals = () => ({
    requests: filteredMonthlyData.reduce((total, data) => total + data.requests, 0),
    completed: filteredMonthlyData.reduce((total, data) => total + data.completed, 0),
    pending: filteredMonthlyData.reduce((total, data) => total + data.pending, 0),
    approved: filteredMonthlyData.reduce((total, data) => total + data.approved, 0),
    disapproved: filteredMonthlyData.reduce((total, data) => total + data.disapproved, 0),
    paper: paperAnalytics.totalSheets,
    paperDocuments: paperAnalytics.totalDocuments
  });

  // Export Functions
  const handleExportExcel = async () => {
    if (!paperUsageIsCurrent || paperUsageLoading || paperUsageError) {
      setExportError(paperUsageError || 'Wait for paper usage data to finish loading before exporting.');
      return;
    }
    if (!startLoading('export-excel')) return;
    setExportError('');
    try {
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      const generatedAt = formatReportDate(new Date(), true);
      const monthLabel = selectedMonth === 'All' ? 'All Months' : months[months.indexOf(selectedMonth)];
      const totals = getMonthlyTotals();
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Barangay Pupua Service Report'],
        ['Reporting period', `${monthLabel} ${selectedYear}`],
        ['Generated', generatedAt],
        [],
        ['Metric', 'Value'],
        ['Total service requests', processedData.totalRequests],
        ['Completed requests', processedData.statusSummary.completed],
        ['Pending requests', processedData.statusSummary.pending],
        ['Approved requests', processedData.statusSummary.approved],
        ['Disapproved requests', processedData.statusSummary.disapproved],
        ['Total processed requests', processingPerformance.totalProcessed],
        ['Completion rate', processingPerformance.completionRate / 100],
        ['Average processing time', formatProcessingDuration(processingPerformance.averageProcessingMs)],
        ['Awaiting review', processingPerformance.pending],
        ['Residents served', processedData.uniqueResidents],
        ['Most requested service', processedData.mostRequestedService?.service || 'No requests'],
        ['Most requested service count', processedData.mostRequestedService?.requests ?? 0],
        ['Total documents printed', paperAnalytics.totalDocuments],
        ['Total paper sheets used', paperAnalytics.totalSheets],
        ['Paper usage measurement', 'Admin-confirmed browser print; physical output is not verified']
      ]);
      summarySheet['B12'].z = '0%';
      summarySheet['!cols'] = [{ wch: 34 }, { wch: 28 }];

      const monthlySheet = XLSX.utils.json_to_sheet([
        ...filteredMonthlyData.map(data => ({
          Month: data.month,
          'Total requests': data.requests,
          Completed: data.completed,
          Pending: data.pending,
          Approved: data.approved,
          Disapproved: data.disapproved,
          'Total processed requests': data.completed + data.disapproved,
          'Paper documents printed': paperByMonth.get(data.month)?.documents || 0,
          'Paper sheets used': paperByMonth.get(data.month)?.sheets || 0,
          'Completion rate': data.completed + data.disapproved > 0 ? data.completed / (data.completed + data.disapproved) : 0
        })),
        {
          Month: 'Total',
          'Total requests': totals.requests,
          Completed: totals.completed,
          Pending: totals.pending,
          Approved: totals.approved,
          Disapproved: totals.disapproved,
          'Total processed requests': processingPerformance.totalProcessed,
          'Paper documents printed': totals.paperDocuments,
          'Paper sheets used': totals.paper,
          'Completion rate': processingPerformance.completionRate / 100
        }
      ]);
      monthlySheet['!cols'] = [
        { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
        { wch: 15 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 18 }
      ];
      for (let row = 2; row <= filteredMonthlyData.length + 2; row += 1) {
        const cell = monthlySheet[`J${row}`];
        if (cell) cell.z = '0%';
      }

      const serviceSheet = XLSX.utils.json_to_sheet([
        ...processedData.requestsByService.map(data => ({
          Service: data.service,
          'Request count': data.requests
        })),
        { Service: 'Total', 'Request count': processedData.totalRequests }
      ]);
      serviceSheet['!cols'] = [{ wch: 36 }, { wch: 18 }];

      const requestHeaders = [
        'Reference number', 'Resident name', 'Service type', 'Status', 'Request date',
        'Appointment date', 'Appointment time', 'Queue number', 'Admin notes'
      ];
      const requestSheet = XLSX.utils.aoa_to_sheet([
        requestHeaders,
        ...processedData.finalFiltered.map(request => [
          request.referenceNumber || request.id || '',
          request.residentName || '',
          request.serviceType || 'Other',
          request.status || '',
          formatReportDate(request.createdAt, true),
          formatReportDate(request.appointmentDate),
          request.appointmentTime || '',
          request.queueNumber ?? '',
          request.adminNotes || ''
        ])
      ]);
      requestSheet['!cols'] = [
        { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 16 },
        { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 48 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Breakdown');
      XLSX.utils.book_append_sheet(workbook, serviceSheet, 'Service Breakdown');
      XLSX.utils.book_append_sheet(workbook, requestSheet, 'Request Records');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
        ...paperAnalytics.byService.map(data => ({
          Service: data.service,
          'Documents printed': data.documents,
          'Pages printed': data.pages,
          'Sheets used': data.sheets
        })),
        {
          Service: 'Total',
          'Documents printed': paperAnalytics.totalDocuments,
          'Pages printed': paperRecords.reduce((total, record) => total + record.pagesPrinted, 0),
          'Sheets used': paperAnalytics.totalSheets
        }
      ]), 'Paper by Service');
      const printHistorySheet = XLSX.utils.aoa_to_sheet([
        ['Printed at', 'Request ID', 'Resident name', 'Resident ID', 'Service type', 'Document type', 'Pages', 'Sheets', 'Administrator ID', 'Administrator'],
        ...paperRecords.map(record => [
          formatReportDate(record.printedAt, true),
          record.requestId || '',
          record.residentName,
          record.residentId || '',
          record.serviceType,
          record.documentType,
          record.pagesPrinted,
          record.sheetsUsed,
          record.adminUserId || '',
          record.adminName
        ])
      ]);
      printHistorySheet['!cols'] = [
        { wch: 22 }, { wch: 38 }, { wch: 26 }, { wch: 38 }, { wch: 28 },
        { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 38 }, { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(workbook, printHistorySheet, 'Print History');
      XLSX.writeFile(workbook, `Barangay_Report_${selectedYear}_${selectedMonth}.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel report:', error);
      setExportError('Excel export failed. Please try again.');
    } finally {
      stopLoading('export-excel');
    }
  };

  const handleExportPDF = async () => {
    if (!paperUsageIsCurrent || paperUsageLoading || paperUsageError) {
      setExportError(paperUsageError || 'Wait for paper usage data to finish loading before exporting.');
      return;
    }
    if (!startLoading('export-pdf')) return;
    setExportError('');
    try {
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const generatedAt = new Date();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const left = 14;
      const right = pageWidth - 14;
      const monthLabel = selectedMonth === 'All' ? 'All Months' : months[months.indexOf(selectedMonth)];
      const totals = getMonthlyTotals();

      doc.setProperties({ title: `Barangay Service Report - ${monthLabel} ${selectedYear}`, subject: SYSTEM_NAME });
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('BARANGAY PUPUA', left, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(SYSTEM_NAME, left, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Service Requests Report', left, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Reporting period: ${monthLabel} ${selectedYear}`, left, 41);
      doc.text(`Generated: ${generatedAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`, left, 47);

      let cursorY = 56;
      const section = (title: string, head: string[], body: (string | number)[][], widths?: number[]) => {
        if (cursorY > pageHeight - 35) {
          doc.addPage();
          cursorY = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(title, left, cursorY);
        autoTable(doc, {
          startY: cursorY + 3,
          margin: { left, right: 14, top: 14, bottom: 18 },
          head: [head],
          body,
          ...(widths ? { columnStyles: Object.fromEntries(widths.map((cellWidth, index) => [index, { cellWidth }])) } : {}),
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.15, overflow: 'linebreak' },
          headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          rowPageBreak: 'avoid'
        });
        const tableDocument = doc as jsPDF & { lastAutoTable: { finalY: number } };
        cursorY = tableDocument.lastAutoTable.finalY + 9;
      };

      section('Summary', ['Metric', 'Value'], [
        ['Total service requests', processedData.totalRequests],
        ['Completed requests', processedData.statusSummary.completed],
        ['Pending requests', processedData.statusSummary.pending],
        ['Approved requests', processedData.statusSummary.approved],
        ['Disapproved requests', processedData.statusSummary.disapproved],
        ['Total processed requests', processingPerformance.totalProcessed],
        ['Completion rate', `${processingPerformance.completionRate.toFixed(1)}%`],
        ['Average processing time', formatProcessingDuration(processingPerformance.averageProcessingMs)],
        ['Awaiting review', processingPerformance.pending],
        ['Residents served', processedData.uniqueResidents],
        ['Most requested service', processedData.mostRequestedService?.service || 'No requests'],
        ['Most requested service count', processedData.mostRequestedService?.requests ?? 0],
        ['Total documents printed', paperAnalytics.totalDocuments],
        ['Total paper sheets used', paperAnalytics.totalSheets],
        ['Paper usage measurement', 'Admin-confirmed browser print; physical output is not verified']
      ], [100, 82]);

      section('Monthly Service Requests and Paper Usage', ['Month', 'Requests', 'Completed', 'Pending', 'Approved', 'Disapproved', 'Processed', 'Documents printed', 'Paper sheets', 'Complete %'], [
        ...filteredMonthlyData.map(data => [
          data.month, data.requests, data.completed, data.pending, data.approved, data.disapproved,
          data.completed + data.disapproved,
          paperByMonth.get(data.month)?.documents || 0,
          paperByMonth.get(data.month)?.sheets || 0,
          data.completed + data.disapproved > 0
            ? `${Math.round((data.completed / (data.completed + data.disapproved)) * 100)}%`
            : '0%'
        ]),
        ['Total', totals.requests, totals.completed, totals.pending, totals.approved, totals.disapproved,
          processingPerformance.totalProcessed, totals.paperDocuments, totals.paper,
          `${processingPerformance.completionRate.toFixed(1)}%`]
      ]);

      section('Service Breakdown', ['Service', 'Request count'], [
        ...processedData.requestsByService.map(data => [data.service, data.requests]),
        ['Total requests', processedData.totalRequests]
      ], [130, 52]);

      section('Service Processing Performance', ['Metric', 'Value'], [
        ['Total processed requests', processingPerformance.totalProcessed],
        ['Completion rate', `${processingPerformance.completionRate.toFixed(1)}%`],
        ['Average processing time', formatProcessingDuration(processingPerformance.averageProcessingMs)],
        ['Awaiting review', processingPerformance.pending],
        ['Completed', processingPerformance.completed],
        ['Approved / Processing', processingPerformance.approved],
        ['Pending', processingPerformance.pending],
        ['Disapproved', processingPerformance.disapproved]
      ], [100, 82]);

      section('Paper Usage by Service', ['Service', 'Documents printed', 'Pages printed', 'Sheets used'], [
        ...paperAnalytics.byService.map(data => [data.service, data.documents, data.pages, data.sheets]),
        ['Total', paperAnalytics.totalDocuments, paperRecords.reduce((total, record) => total + record.pagesPrinted, 0), paperAnalytics.totalSheets]
      ]);
      section('Print History', ['Printed at', 'Request ID', 'Resident', 'Resident ID', 'Service / Document', 'Pages', 'Sheets', 'Administrator ID', 'Administrator'], paperRecords.map(record => [
        new Date(record.printedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        record.requestId || 'Request removed',
        record.residentName,
        record.residentId || 'Unavailable',
        `${record.serviceType} / ${record.documentType}`,
        record.pagesPrinted,
        record.sheetsUsed,
        record.adminUserId || 'Unavailable',
        record.adminName
      ]));

      if (cursorY > pageHeight - 30) {
        doc.addPage();
        cursorY = 24;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text('Prepared by: ______________________________', left, cursorY + 4);
      doc.text('Verified by: ______________________________', pageWidth / 2 + 5, cursorY + 4);

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(203, 213, 225);
        doc.line(left, pageHeight - 14, right, pageHeight - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${SYSTEM_NAME}  ·  ${monthLabel} ${selectedYear}`, left, pageHeight - 9);
        doc.text(`Page ${page} of ${pageCount}`, right, pageHeight - 9, { align: 'right' });
      }

      doc.save(`Barangay_Report_${selectedYear}_${selectedMonth}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF report:', error);
      setExportError(error instanceof Error ? error.message : 'PDF export failed. Please try again.');
    } finally {
      stopLoading('export-pdf');
    }
  };

  const handlePrint = () => {
    if (!paperUsageIsCurrent || paperUsageLoading || paperUsageError) {
      setExportError(paperUsageError || 'Wait for paper usage data to finish loading before printing.');
      return;
    }
    window.print();
  };
  const monthlyTotals = getMonthlyTotals();

  return (
    <div className="admin-reports flex min-w-0 flex-col gap-4 sm:gap-5">
      {/* Header & Filters */}
      <div className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] leading-tight">Reports</h2>
            <p className="text-[11px] text-[#64748B]">Comprehensive overview of barangay services.</p>
          </div>
        </div>
        
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-[#F8FAFC] px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F0]">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#0F172A] outline-none"
            >
              {reportYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-[#F8FAFC] px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F0]">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#0F172A] outline-none"
            >
              <option value="All">All Months</option>
              <option value="Jan">January</option>
              <option value="Feb">February</option>
              <option value="Mar">March</option>
              <option value="Apr">April</option>
              <option value="May">May</option>
              <option value="Jun">June</option>
              <option value="Jul">July</option>
              <option value="Aug">August</option>
              <option value="Sep">September</option>
              <option value="Oct">October</option>
              <option value="Nov">November</option>
              <option value="Dec">December</option>
            </select>
          </div>

          <div className="h-6 w-px bg-[#E2E8F0] mx-1 hidden md:block"></div>

          <button 
            onClick={handlePrint}
            disabled={!paperUsageIsCurrent || paperUsageLoading || Boolean(paperUsageError && paperUsageIsCurrent)}
            className="flex min-h-9 items-center gap-1.5 rounded-[6px] border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button 
            onClick={handleExportExcel}
            disabled={isLoading('export-excel') || !paperUsageIsCurrent || paperUsageLoading || Boolean(paperUsageError && paperUsageIsCurrent)}
            className="flex min-h-9 items-center gap-1.5 rounded-[6px] border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
          >
            {isLoading('export-excel') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            {isLoading('export-excel') ? 'Exporting…' : 'Excel'}
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isLoading('export-pdf') || !paperUsageIsCurrent || paperUsageLoading || Boolean(paperUsageError && paperUsageIsCurrent)}
            className="flex min-h-9 items-center gap-1.5 rounded-[6px] bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8]"
          >
            {isLoading('export-pdf') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isLoading('export-pdf') ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {exportError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 2xl:grid-cols-6">
        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Total Requests</p>
            <div className="w-6 h-6 bg-[#EFF6FF] text-[#2563EB] rounded-[6px] flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">{processedData.totalRequests}</h3>
        </div>
        
        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Completed Requests</p>
            <div className="w-6 h-6 bg-[#EFF6FF] text-[#2563EB] rounded-[6px] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">
            {processedData.statusSummary.completed}
          </h3>
        </div>
 
        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Pending Requests</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-amber-50 text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">
            {processedData.finalFiltered.filter(request => request.status?.toLowerCase() === 'pending').length}
          </h3>
        </div>
 
        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Residents Served</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#EFF6FF] text-[#2563EB]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">{processedData.uniqueResidents}</h3>
        </div>

        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Approved Requests</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">{processedData.statusSummary.approved}</h3>
        </div>

        <div className="flex min-h-[88px] flex-col justify-center rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#64748B] sm:text-[10px]">Disapproved</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-red-50 text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl font-bold leading-none text-[#0F172A] sm:text-2xl">{processedData.statusSummary.disapproved}</h3>
        </div>
      </div>

      {/* Monthly Requests */}
      <section className="report-panel min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4" aria-labelledby="monthly-requests-title">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="monthly-requests-title" className="text-sm font-bold text-[#0F172A]">Monthly Requests</h3>
            <p className="text-[11px] text-[#64748B]">
              {selectedMonth === 'All' ? `Request volume across ${selectedYear}` : `Request volume for ${selectedMonth} ${selectedYear}`}
            </p>
          </div>
          <span className="rounded-full bg-[#EFF6FF] px-2 py-1 text-[10px] font-semibold text-[#2563EB]">
            Peak: {highestMonthlyRequestCount}
          </span>
        </div>
        <div className="h-[190px] w-full min-w-0 sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredMonthlyData} margin={{ top: 20, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }} width={34} />
              <Tooltip
                formatter={(value, name) => [value, name === 'requests' ? 'Requests' : name]}
                contentStyle={{ borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, backgroundColor: isDark ? '#111827' : '#fff', color: isDark ? '#F8FAFC' : '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '7px 10px', fontSize: '11px' }}
              />
              <Bar dataKey="requests" name="Requests" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {filteredMonthlyData.map((data) => (
                  <Cell
                    key={data.month}
                    fill={selectedMonth === 'All' || selectedMonth === data.month ? '#2563EB' : (isDark ? '#334155' : '#CBD5E1')}
                  />
                ))}
                <LabelList dataKey="requests" position="top" fill={isDark ? '#CBD5E1' : '#475569'} fontSize={9} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {highestMonthlyRequestCount === 0 && (
          <p className="text-center text-[10px] text-[#64748B]">No requests recorded for this year.</p>
        )}
      </section>

      {/* Service, status, and resource charts */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <section className="report-panel min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4" aria-labelledby="most-requested-title">
          <div className="mb-2">
            <h3 id="most-requested-title" className="text-sm font-bold text-[#0F172A]">Most Requested Services</h3>
            <p className="text-[11px] text-[#64748B]">Request counts for {selectedMonth === 'All' ? selectedYear : `${selectedMonth} ${selectedYear}`}</p>
            {processedData.mostRequestedService && (
              <p className="mt-1 text-[10px] font-semibold text-[#2563EB]">
                Top service: {processedData.mostRequestedService.service} ({processedData.mostRequestedService.requests})
              </p>
            )}
          </div>
          {processedData.requestsByService.length > 0 ? (
            <div className="h-[190px] w-full min-w-0 sm:h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.requestsByService} layout="vertical" margin={{ top: 2, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 9 }} />
                  <YAxis
                    dataKey="service"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDark ? '#CBD5E1' : '#334155', fontSize: 9 }}
                    tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}…` : value}
                    width={96}
                  />
                  <Tooltip
                    formatter={(value) => [value, 'Requests']}
                    contentStyle={{ borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, backgroundColor: isDark ? '#111827' : '#fff', color: isDark ? '#F8FAFC' : '#0F172A', padding: '7px 10px', fontSize: '11px' }}
                  />
                  <Bar dataKey="requests" name="Requests" fill="#2563EB" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList dataKey="requests" position="right" fill={isDark ? '#CBD5E1' : '#475569'} fontSize={9} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[110px] items-center justify-center text-[11px] text-[#64748B]">No service requests for this period.</div>
          )}
        </section>

        <section className="report-panel min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4" aria-labelledby="status-distribution-title">
          <div className="mb-3">
            <h3 id="status-distribution-title" className="text-sm font-bold text-[#0F172A]">Request Status</h3>
            <p className="text-[11px] text-[#64748B]">Distribution for {selectedMonth === 'All' ? selectedYear : `${selectedMonth} ${selectedYear}`}</p>
          </div>
          {processedData.totalRequests > 0 ? (
            <>
              <div
                className="request-status-bar flex h-3.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]"
                role="img"
                aria-label={statusDistribution.map(status => `${status.name}: ${status.value}`).join(', ')}
              >
                {statusDistribution.map(status => status.value > 0 && (
                  <div
                    key={status.key}
                    title={`${status.name}: ${status.value}`}
                    style={{ width: `${(status.value / processedData.totalRequests) * 100}%`, backgroundColor: status.color }}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
                {statusDistribution.map(status => (
                  <div key={status.key} className="flex min-w-0 items-center justify-between gap-2 text-[10px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-[#64748B]">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="truncate">{status.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-[#0F172A]">{status.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[110px] items-center justify-center text-[11px] text-[#64748B]">No requests for this period.</div>
          )}
        </section>

        <section className="report-panel min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:col-span-2 sm:p-4 xl:col-span-1" aria-labelledby="paper-usage-title">
          <div className="mb-3">
            <h3 id="paper-usage-title" className="text-sm font-bold text-[#0F172A]">Paper Usage</h3>
            <p className="text-[11px] text-[#64748B]">Print events for {selectedMonth === 'All' ? selectedYear : `${selectedMonth} ${selectedYear}`}</p>
            <p className="mt-1 text-[9px] leading-snug text-[#64748B]">Based on administrator confirmation; printer output cannot be verified by the system.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-[#F8FAFC] px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Total sheets used</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0F172A]">{!paperUsageIsCurrent || paperUsageLoading || paperUsageError ? '—' : paperAnalytics.totalSheets}</p>
              </div>
              <div className="rounded-md bg-[#F8FAFC] px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Documents printed</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0F172A]">{!paperUsageIsCurrent || paperUsageLoading || paperUsageError ? '—' : paperAnalytics.totalDocuments}</p>
              </div>
            </div>
          </div>
          {!paperUsageIsCurrent || paperUsageLoading ? (
            <div className="flex h-[180px] items-center justify-center gap-2 text-[11px] text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading print records…
            </div>
          ) : paperUsageError ? (
            <div role="alert" className="flex min-h-[130px] items-center justify-center text-center text-[11px] text-red-700">{paperUsageError}</div>
          ) : paperAnalytics.totalDocuments > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold text-[#475569]">Sheets by service</p>
                <div className="h-[135px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paperAnalytics.byService} layout="vertical" margin={{ top: 0, right: 18, bottom: 0, left: 0 }}>
                      <CartesianGrid horizontal={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 9 }} />
                      <YAxis dataKey="service" type="category" axisLine={false} tickLine={false}
                        tick={{ fill: isDark ? '#CBD5E1' : '#334155', fontSize: 9 }}
                        tickFormatter={(value: string) => value.length > 14 ? `${value.slice(0, 13)}…` : value} width={88} />
                      <Tooltip formatter={(value) => [value, 'Sheets used']}
                        contentStyle={{ borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, backgroundColor: isDark ? '#111827' : '#fff', color: isDark ? '#F8FAFC' : '#0F172A', padding: '7px 10px', fontSize: '11px' }} />
                      <Bar dataKey="sheets" name="Sheets used" fill="#F59E0B" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {paperAnalytics.byService.map((entry, index) => (
                          <Cell key={`paper-${entry.service}`} fill={['#F59E0B', '#2563EB', '#10B981', '#6366F1'][index % 4]} />
                        ))}
                        <LabelList dataKey="sheets" position="right" fill={isDark ? '#CBD5E1' : '#475569'} fontSize={9} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold text-[#475569]">Monthly paper consumption</p>
                <div className="h-[105px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredPaperMonthlyData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 8 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 8 }} />
                      <Tooltip formatter={(value) => [value, 'Sheets used']}
                        contentStyle={{ borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, backgroundColor: isDark ? '#111827' : '#fff', color: isDark ? '#F8FAFC' : '#0F172A', padding: '7px 10px', fontSize: '11px' }} />
                      <Bar dataKey="sheets" name="Sheets used" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[150px] items-center justify-center text-center text-[11px] text-[#64748B]">
              No printing records are available for the selected period.
            </div>
          )}
        </section>

        <section className="report-panel min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:col-span-2 sm:p-4 xl:col-span-1" aria-labelledby="processing-performance-title">
          <div className="mb-3">
            <h3 id="processing-performance-title" className="text-sm font-bold text-[#0F172A]">Service Processing Performance</h3>
            <p className="text-[11px] text-[#64748B]">{selectedMonth === 'All' ? selectedYear : `${selectedMonth} ${selectedYear}`}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total processed', value: processingPerformance.totalProcessed, color: 'text-[#0F172A]' },
              { label: 'Completion rate', value: `${processingPerformance.completionRate.toFixed(1)}%`, color: 'text-emerald-600' },
              { label: 'Average processing time', value: formatProcessingDuration(processingPerformance.averageProcessingMs), color: 'text-[#0F172A]' },
              { label: 'Awaiting review', value: processingPerformance.pending, color: 'text-amber-600' }
            ].map(item => (
              <div key={item.label} className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2">
                <p className="text-[9px] font-medium text-[#64748B]">{item.label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[#E2E8F0] pt-2">
            <p className="mb-1.5 text-[10px] font-semibold text-[#475569]">Processing breakdown</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Completed</dt><dd className="font-semibold tabular-nums text-emerald-600">{processingPerformance.completed}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Approved / Processing</dt><dd className="font-semibold tabular-nums text-blue-600">{processingPerformance.approved}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Pending</dt><dd className="font-semibold tabular-nums text-amber-600">{processingPerformance.pending}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Disapproved</dt><dd className="font-semibold tabular-nums text-red-600">{processingPerformance.disapproved}</dd></div>
            </dl>
          </div>
        </section>
      </div>

      <details className="report-details overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[#0F172A] marker:hidden sm:px-4">
          <span>View Monthly Details</span>
          <span className="text-[10px] font-medium text-[#64748B]">{selectedMonth === 'All' ? `12 months · ${selectedYear}` : `${selectedMonth} ${selectedYear}`}</span>
        </summary>
        <div className="border-t border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-wide text-[#64748B] sm:text-[10px]">
                  <th className="w-[12%] px-2 py-2 sm:px-3">Month</th>
                  <th className="w-[16%] px-1 py-2 text-right sm:px-3">Requests</th>
                  <th className="w-[16%] px-1 py-2 text-right sm:px-3">Completed</th>
                  <th className="w-[21%] px-1 py-2 text-right sm:px-3"><span className="hidden sm:inline">Not completed</span><span className="sm:hidden">Other</span></th>
                  <th className="w-[16%] px-1 py-2 text-right sm:px-3">Sheets</th>
                  <th className="w-[19%] px-2 py-2 text-right sm:px-3">Complete %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredMonthlyData.map(data => (
                  <tr key={data.month} className="text-[10px] sm:text-xs">
                    <td className="px-2 py-2 font-semibold text-[#0F172A] sm:px-3">{data.month}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-[#0F172A] sm:px-3">{data.requests}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-emerald-600 sm:px-3">{data.completed}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-amber-600 sm:px-3">{data.requests - data.completed}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-[#0F172A] sm:px-3">
                      {!paperUsageIsCurrent || paperUsageLoading || paperUsageError ? '—' : paperByMonth.get(data.month)?.sheets || 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#0F172A] sm:px-3">
                      {data.completed + data.disapproved > 0
                        ? Math.round((data.completed / (data.completed + data.disapproved)) * 100)
                        : 0}%
                    </td>
                  </tr>
                ))}
                {filteredMonthlyData.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-5 text-center text-[11px] text-[#64748B]">No data available for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <article className="admin-report-print" aria-hidden="true">
        <header className="print-report-header">
          <div>
            <p className="print-report-kicker">BARANGAY PUPUA</p>
            <p>{SYSTEM_NAME}</p>
            <h1>Service Requests Report</h1>
          </div>
        </header>
        <div className="print-report-meta">
          <span><strong>Reporting period:</strong> {selectedMonth === 'All' ? 'All Months' : months[months.indexOf(selectedMonth)]} {selectedYear}</span>
          <span><strong>Generated:</strong> {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
        </div>

        <section className="print-report-section">
          <h2>Summary</h2>
          <table>
            <tbody>
              <tr><th>Total service requests</th><td>{processedData.totalRequests}</td><th>Residents served</th><td>{processedData.uniqueResidents}</td></tr>
              <tr><th>Completed requests</th><td>{processedData.statusSummary.completed}</td><th>Pending requests</th><td>{processedData.statusSummary.pending}</td></tr>
              <tr><th>Approved requests</th><td>{processedData.statusSummary.approved}</td><th>Disapproved requests</th><td>{processedData.statusSummary.disapproved}</td></tr>
              <tr><th>Most requested service</th><td>{processedData.mostRequestedService?.service || 'No requests'}</td><th>Requests for top service</th><td>{processedData.mostRequestedService?.requests ?? 0}</td></tr>
              <tr><th>Total processed requests</th><td>{processingPerformance.totalProcessed}</td><th>Completion rate</th><td>{processingPerformance.completionRate.toFixed(1)}%</td></tr>
              <tr><th>Average processing time</th><td>{formatProcessingDuration(processingPerformance.averageProcessingMs)}</td><th>Awaiting review</th><td>{processingPerformance.pending}</td></tr>
              <tr><th>Documents printed</th><td>{paperAnalytics.totalDocuments}</td><th>Paper sheets used</th><td>{paperAnalytics.totalSheets}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="print-report-section">
          <h2>Monthly Service Requests and Paper Usage</h2>
          <table>
            <thead>
              <tr><th>Month</th><th>Total requests</th><th>Completed</th><th>Pending</th><th>Approved</th><th>Disapproved</th><th>Processed</th><th>Documents printed</th><th>Paper sheets used</th><th>Complete %</th></tr>
            </thead>
            <tbody>
              {filteredMonthlyData.map(data => (
                <tr key={`print-${data.month}`}>
                  <td>{data.month}</td><td>{data.requests}</td><td>{data.completed}</td>
                  <td>{data.pending}</td><td>{data.approved}</td><td>{data.disapproved}</td>
                  <td>{data.completed + data.disapproved}</td>
                  <td>{paperByMonth.get(data.month)?.documents || 0}</td>
                  <td>{paperByMonth.get(data.month)?.sheets || 0}</td>
                  <td>{data.completed + data.disapproved > 0
                    ? `${Math.round((data.completed / (data.completed + data.disapproved)) * 100)}%`
                    : '0%'}</td>
                </tr>
              ))}
              {filteredMonthlyData.length > 0 && (
                <tr>
                  <th>Total</th><td>{monthlyTotals.requests}</td><td>{monthlyTotals.completed}</td>
                  <td>{monthlyTotals.pending}</td><td>{monthlyTotals.approved}</td><td>{monthlyTotals.disapproved}</td>
                  <td>{processingPerformance.totalProcessed}</td><td>{monthlyTotals.paperDocuments}</td>
                  <td>{monthlyTotals.paper}</td>
                  <td>{processingPerformance.completionRate.toFixed(1)}%</td>
                </tr>
              )}
              {filteredMonthlyData.length === 0 && <tr><td colSpan={10}>No data available for this period.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="print-report-section">
          <h2>Service Breakdown</h2>
          <p>Most requested service: {processedData.mostRequestedService?.service || 'No requests'} ({processedData.mostRequestedService?.requests ?? 0} requests)</p>
          <table>
            <thead><tr><th>Service</th><th>Request count</th></tr></thead>
            <tbody>
              {processedData.requestsByService.map(data => (
                <tr key={`print-service-${data.service}`}><td>{data.service}</td><td>{data.requests}</td></tr>
              ))}
              {processedData.requestsByService.length === 0 && <tr><td colSpan={2}>No service requests for this period.</td></tr>}
              <tr><th>Most requested service</th><td>{processedData.mostRequestedService?.service || 'No requests'}</td></tr>
              <tr><th>Total requests</th><td>{processedData.totalRequests}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="print-report-section">
          <h2>Service Processing Performance</h2>
          <table>
            <tbody>
              <tr><th>Total processed requests</th><td>{processingPerformance.totalProcessed}</td></tr>
              <tr><th>Completion rate</th><td>{processingPerformance.completionRate.toFixed(1)}%</td></tr>
              <tr><th>Average processing time</th><td>{formatProcessingDuration(processingPerformance.averageProcessingMs)}</td></tr>
              <tr><th>Awaiting review</th><td>{processingPerformance.pending}</td></tr>
              <tr><th>Completed</th><td>{processingPerformance.completed}</td></tr>
              <tr><th>Approved / Processing</th><td>{processingPerformance.approved}</td></tr>
              <tr><th>Pending</th><td>{processingPerformance.pending}</td></tr>
              <tr><th>Disapproved</th><td>{processingPerformance.disapproved}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="print-report-section">
          <h2>Paper Usage by Service</h2>
          <p>These counts reflect administrator-confirmed browser print events; physical printer output is not verified by the system.</p>
          <table>
            <thead><tr><th>Service</th><th>Documents printed</th><th>Pages printed</th><th>Sheets used</th></tr></thead>
            <tbody>
              {paperAnalytics.byService.map(data => (
                <tr key={`print-paper-${data.service}`}><td>{data.service}</td><td>{data.documents}</td><td>{data.pages}</td><td>{data.sheets}</td></tr>
              ))}
              {paperAnalytics.totalDocuments === 0 && <tr><td colSpan={4}>No printing records are available for this period.</td></tr>}
              <tr><th>Total</th><td>{paperAnalytics.totalDocuments}</td><td>{paperAnalytics.byService.reduce((total, data) => total + data.pages, 0)}</td><td>{paperAnalytics.totalSheets}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="print-report-section">
          <h2>Print History</h2>
          <table>
            <thead><tr><th>Printed at</th><th>Request ID</th><th>Resident</th><th>Resident ID</th><th>Document</th><th>Pages</th><th>Sheets</th><th>Administrator ID</th><th>Administrator</th></tr></thead>
            <tbody>
              {paperRecords.map(record => (
                <tr key={`print-event-${record.id}`}>
                  <td>{new Date(record.printedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                  <td>{record.requestId || 'Request removed'}</td>
                  <td>{record.residentName}</td>
                  <td>{record.residentId || 'Unavailable'}</td>
                  <td>{record.documentType}</td>
                  <td>{record.pagesPrinted}</td>
                  <td>{record.sheetsUsed}</td>
                  <td>{record.adminUserId || 'Unavailable'}</td>
                  <td>{record.adminName}</td>
                </tr>
              ))}
              {paperRecords.length === 0 && <tr><td colSpan={9}>No printing records are available for this period.</td></tr>}
            </tbody>
          </table>
        </section>

        <div className="print-report-signatures">
          <div>Prepared by: __________________________________</div>
          <div>Verified by: __________________________________</div>
        </div>
      </article>
    </div>
  );
}
