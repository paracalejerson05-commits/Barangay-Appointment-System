import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Files,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { BARANGAY_LOGO_URL, BARANGAY_LOGO_FALLBACK } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function AdminReports({ requests, residents }: { requests: any[], residents: any[] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('All');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Centralized Data Processing
  const processedData = useMemo(() => {
    // 1. Filter requests by selected year
    const yearFiltered = requests.filter(req => {
      if (!req.createdAt) return false;
      const date = req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
      return date.getFullYear().toString() === selectedYear;
    });

    // 2. Further filter by month if selected
    const finalFiltered = selectedMonth === 'All' 
      ? yearFiltered 
      : yearFiltered.filter(req => {
          const date = req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
          return months[date.getMonth()] === selectedMonth;
        });

    // 3. Calculate Summary Stats
    const totalRequests = finalFiltered.length;
    const uniqueResidents = new Set(finalFiltered.map(r => r.residentUid)).size;
    const approvedCompleted = finalFiltered.filter(r => r.status === 'approved' || r.status === 'completed').length;
    // Assume 1 sheet per request for now, or use a field if available
    const paperUsage = finalFiltered.filter(r => r.status !== 'disapproved').length;

    // 4. Monthly Performance Trends
    const monthlyTrends = months.map((m, idx) => {
      const monthRequests = yearFiltered.filter(req => {
        const date = req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
        return date.getMonth() === idx;
      });
      
      return {
        month: m,
        requests: monthRequests.length,
        completed: monthRequests.filter(r => r.status === 'completed').length,
        paper: monthRequests.filter(r => r.status !== 'disapproved').length
      };
    });

    // 5. Paper Usage by Service
    const serviceGroups: Record<string, number> = {};
    finalFiltered.forEach(req => {
      if (req.status !== 'disapproved') {
        const type = req.serviceType || 'Other';
        serviceGroups[type] = (serviceGroups[type] || 0) + 1;
      }
    });
    const paperByService = Object.entries(serviceGroups).map(([service, paper]) => ({ service, paper }));

    return {
      finalFiltered,
      totalRequests,
      uniqueResidents,
      approvedCompleted,
      paperUsage,
      monthlyTrends,
      paperByService
    };
  }, [requests, selectedYear, selectedMonth]);

  const filteredMonthlyData = selectedMonth === 'All' 
    ? processedData.monthlyTrends 
    : processedData.monthlyTrends.filter(d => d.month === selectedMonth);

  // Export Functions
  const handleExportExcel = () => {
    const data = processedData.finalFiltered.map(req => ({
      'Resident Name': req.residentName,
      'Service Type': req.serviceType,
      'Status': req.status,
      'Date': req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'N/A',
      'Admin Notes': req.adminNotes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Service Requests');
    XLSX.writeFile(wb, `Barangay_Report_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Barangay Service Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Year: ${selectedYear} | Month: ${selectedMonth}`, 14, 30);
    doc.text(`Total Requests: ${processedData.totalRequests}`, 14, 38);
    doc.text(`Residents Served: ${processedData.uniqueResidents}`, 14, 46);

    const tableData = processedData.finalFiltered.map(req => [
      req.residentName,
      req.serviceType,
      req.status,
      req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Resident Name', 'Service Type', 'Status', 'Date']],
      body: tableData,
    });

    doc.save(`Barangay_Report_${selectedYear}_${selectedMonth}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-[10px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center bg-white p-1 rounded-[8px] border border-[#E2E8F0] overflow-hidden flex-shrink-0">
            <img 
              src={BARANGAY_LOGO_URL} 
              alt="Barangay Logo" 
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = BARANGAY_LOGO_FALLBACK;
              }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] leading-tight">Reports & Analytics</h2>
            <p className="text-[11px] text-[#64748B]">Comprehensive overview of barangay services.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-[#F8FAFC] px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F0]">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#0F172A] outline-none"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-semibold rounded-[6px] transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-[6px] transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Total Requests</p>
            <div className="w-6 h-6 bg-[#EFF6FF] text-[#2563EB] rounded-[6px] flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] leading-none">{processedData.totalRequests}</h3>
        </div>
        
        <div className="bg-white p-4 rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Residents Served</p>
            <div className="w-6 h-6 bg-[#EFF6FF] text-[#2563EB] rounded-[6px] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] leading-none">{processedData.uniqueResidents}</h3>
        </div>
 
        <div className="bg-white p-4 rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Approved & Done</p>
            <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-[6px] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] leading-none">{processedData.approvedCompleted}</h3>
        </div>
 
        <div className="bg-white p-4 rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Paper Usage</p>
            <div className="w-6 h-6 bg-amber-50 text-amber-600 rounded-[6px] flex items-center justify-center">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-2xl font-bold text-[#0F172A] leading-none">{processedData.paperUsage}</h3>
            <span className="text-[10px] text-[#64748B]">sheets</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trends Line Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-[10px] border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Performance Trends</h3>
              <p className="text-[11px] text-[#64748B]">Requests, completions, and paper usage over time</p>
            </div>
            <div className="p-1.5 bg-[#EFF6FF] rounded-[6px]">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredMonthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dx={-10} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dx={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '8px 12px', fontSize: '12px' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="requests" name="Total Requests" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                <Line yAxisId="left" type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="paper" name="Paper Used" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Paper Usage Bar Chart */}
        <div className="bg-white p-5 rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#0F172A]">Resource Usage</h3>
            <p className="text-[11px] text-[#64748B]">Paper consumption by service</p>
          </div>
          <div className="h-[280px] w-full flex-1">
            {processedData.paperByService.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.paperByService} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} />
                  <YAxis dataKey="service" type="category" axisLine={false} tickLine={false} tick={{ fill: '#0F172A', fontSize: 10, fontWeight: 500 }} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '11px', padding: '8px 12px' }}
                  />
                  <Bar dataKey="paper" name="Sheets Used" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20}>
                    {processedData.paperByService.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#F59E0B', '#2563EB', '#10B981', '#6366F1'][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] gap-2">
                <AlertCircle className="w-6 h-6 opacity-40" />
                <p className="text-[11px] font-medium">No service data for this period</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-[#0F172A]">Detailed Monthly Breakdown</h3>
          <p className="text-[11px] text-[#64748B]">Requests, processing status, and resource usage per month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Total Requests</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Pending/Rejected</th>
                <th className="px-4 py-3 text-right">Paper Used</th>
                <th className="px-4 py-3 text-right">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredMonthlyData.some(d => d.requests > 0) ? (
                filteredMonthlyData.map((data, index) => (
                  <tr key={index} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 font-semibold text-xs text-[#0F172A]">{data.month}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{data.requests}</td>
                    <td className="px-4 py-3 text-right text-xs text-emerald-600 font-medium">{data.completed}</td>
                    <td className="px-4 py-3 text-right text-xs text-amber-600 font-medium">{data.requests - data.completed}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{data.paper}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] font-semibold text-[#0F172A]">
                          {data.requests > 0 ? Math.round((data.completed / data.requests) * 100) : 0}%
                        </span>
                        <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${data.requests > 0 ? (data.completed / data.requests) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[11px] text-[#64748B]">
                    No data available for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
