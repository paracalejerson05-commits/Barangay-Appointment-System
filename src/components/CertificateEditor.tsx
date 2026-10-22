import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { XCircle, Printer, Save, Download, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbUpdateServiceRequest } from '../lib/supabaseDb';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ResidenceCertificate } from './certificates/ResidenceCertificate';
import { IndigencyCertificate } from './certificates/IndigencyCertificate';
import { ClearanceCertificate } from './certificates/ClearanceCertificate';
import { BadacCertificate } from './certificates/BadacCertificate';
import { BlotterReport } from './certificates/BlotterReport';

interface CertificateEditorProps {
  request: any;
  onClose: () => void;
  onComplete?: (action: 'PRINT' | 'DOWNLOAD') => Promise<void>;
  initialAction?: 'PRINT' | 'DOWNLOAD' | null;
}

export default function CertificateEditor({ request, onClose, onComplete, initialAction }: CertificateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [actionError, setActionError] = useState('');
  
  const isIndigency = request.serviceType === 'Certificate of Indigency';
  const isClearance = request.serviceType === 'Barangay Clearance';
  const isBadac = request.serviceType === 'BADAC Clearance';
  const isBlotter = /blotter|incident/i.test(request.serviceType || '');

  const generateDefaultData = () => {
    const name = request.residentName || '';
    const age = request.age?.toString() || '';
    const purok = request.purok || '';
    const gender = request.gender || '';
    const civilStatus = request.civilStatus || '';
    
    const today = new Date();
    const day = today.getDate().toString();
    const month = today.toLocaleString('default', { month: 'long' });
    const year = today.getFullYear().toString().slice(-2);
    const fullYear = today.getFullYear().toString();

    if (isIndigency) {
      return {
        name,
        maritalStatus: civilStatus,
        purok,
        pronoun: gender.toLowerCase() === 'female' ? 'She' : 'He',
        day,
        month,
        year: fullYear.slice(-2),
        fullYear
      };
    }

    if (isClearance || isBadac) {
      return {
        name,
        age,
        maritalStatus: civilStatus,
        purok,
        day,
        month,
        fullYear
      };
    }

    return {
      name,
      age,
      purok,
      years: '',
      day,
      month,
      year,
    };
  };

  const [certData, setCertData] = useState(request.certificateData || generateDefaultData());
  const printRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 794, height: 1123 });

  useLayoutEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea) return;

    const updatePreviewScale = () => {
      const page = printRef.current;
      if (!page) return;

      const width = page.offsetWidth;
      const height = Math.max(page.offsetHeight, page.scrollHeight);
      const scale = Math.min(1, Math.max(1, previewArea.clientWidth - 24) / width);
      setPageSize(current => current.width === width && current.height === height ? current : { width, height });
      setPreviewScale(current => Math.abs(current - scale) < 0.001 ? current : scale);
    };

    updatePreviewScale();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updatePreviewScale);
      observer.observe(previewArea);
      if (printRef.current) observer.observe(printRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!(await dbUpdateServiceRequest(request.id, { certificateData: certData }))) {
        throw new Error('The certificate could not be saved to Supabase.');
      }
      return true;
    } catch (error) {
      console.error("Error saving certificate:", error);
      setActionError('Unable to save certificate changes. The request has not been marked as completed.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setCertData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all fields to the resident's default application data?")) {
      setCertData(generateDefaultData());
    }
  };

  const handlePrint = async () => {
    setActionError('');
    if (!(await handleSave())) return;

    setIsPrinting(true);
    const handleAfterPrint = async () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      if (!window.confirm('Did the document print successfully?')) {
        setActionError('Print was canceled or did not succeed. The request has not been marked as completed.');
        setIsPrinting(false);
        return;
      }
      try {
        await onComplete?.('PRINT');
        onClose();
      } catch (error: any) {
        setActionError(error?.message || 'The print action finished, but the request could not be marked completed.');
      } finally {
        setIsPrinting(false);
      }
    };

    window.addEventListener('afterprint', handleAfterPrint, { once: true });
    try {
      window.print();
    } catch (error) {
      window.removeEventListener('afterprint', handleAfterPrint);
      setIsPrinting(false);
      setActionError('Unable to open the print dialog. The request has not been marked as completed.');
    }
  };

  const handleDownloadPDF = async () => {
    setActionError('');
    if (!printRef.current) {
      setActionError('Unable to generate the document. The request has not been marked as completed.');
      return;
    }
    setIsDownloading(true);
    if (!(await handleSave())) {
      setIsDownloading(false);
      return;
    }
    
    // Add temporary class to bypass UI scroll limits and hide UI colors
    document.body.classList.add('is-exporting-pdf');
    const container = printRef.current;
    const previousTransform = container.style.transform;

    // Force container to be fully visible for html2canvas
    container.style.transform = 'none';
    let generated = false;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: container.offsetWidth,
        height: container.offsetHeight,
        windowHeight: container.offsetHeight + 100
      });
      if (!canvas.width || !canvas.height) throw new Error('The document preview is empty.');

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      pdf.save(`${request.serviceType || 'Certificate'}_${(request.residentName || 'Resident').replace(/\s+/g, '_')}.pdf`);
      generated = true;
    } catch (error) {
      console.error("Error generating PDF:", error);
      setActionError('Unable to generate the document. The request has not been marked as completed.');
    }

    if (generated) {
      try {
      await onComplete?.('DOWNLOAD');
      onClose();
      } catch (error: any) {
        setActionError(error?.message || 'The PDF was generated, but the request could not be marked completed.');
      }
    }

    container.style.transform = previousTransform;
    document.body.classList.remove('is-exporting-pdf');
    setIsDownloading(false);
  };

  const initialActionStarted = useRef(false);
  useEffect(() => {
    if (!initialAction || initialActionStarted.current) return;
    initialActionStarted.current = true;
    const timer = setTimeout(() => {
      if (initialAction === 'PRINT') void handlePrint();
      else void handleDownloadPDF();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col md:flex-row bg-white pdf-hide-bg">
      {/* Sidebar Controls */}
      <div className="w-full md:w-[320px] max-h-[44dvh] md:max-h-none shrink-0 border-b md:border-b-0 md:border-r border-[#E2E8F0] bg-white flex flex-col pdf-hidden md:h-full font-sans">
        <div className="p-3 md:p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="font-bold text-[#0F172A]">Certificate Editor</h3>
          <p className="hidden md:block text-xs text-[#64748B]">Review and edit before printing</p>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          <div className="hidden md:block bg-blue-50 text-blue-800 p-3 rounded-lg text-xs border border-blue-100">
            Click on any underlined blank space to edit the resident information. All other text is strictly locked to match the official document template.
          </div>
          
          <button onClick={handleReset} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#E2E8F0] rounded-[6px] text-[#0F172A] text-sm hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-4 h-4" /> Reset Data
          </button>
          
          <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#E2E8F0] rounded-[6px] text-[#0F172A] text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save Changes
          </button>
        </div>

        <div className="p-3 md:p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] grid grid-cols-2 md:flex md:flex-col gap-2">
          {actionError && (
            <div role="alert" className="col-span-2 md:col-span-1 flex items-start gap-2 p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-[6px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}
          <button onClick={handleDownloadPDF} disabled={isDownloading || isPrinting || isSaving} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#E2E8F0] rounded-[6px] text-[#0F172A] font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          
          <button onClick={handlePrint} disabled={isPrinting || isDownloading || isSaving} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] font-semibold text-sm transition-colors shadow-sm disabled:opacity-50">
            {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {request.status === 'completed' ? 'Reprint Document' : 'Print Document'}
          </button>

          <button onClick={onClose} className="col-span-2 md:col-span-1 w-full py-2 px-4 text-[#64748B] hover:text-[#0F172A] text-sm transition-colors">
            Cancel & Close
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div ref={previewAreaRef} className="flex-1 min-h-0 min-w-0 overflow-auto bg-[#F1F5F9] flex items-start justify-center p-3 md:p-8 print:p-0 print:bg-white pdf-print-container">
        <div
          className="certificate-preview-frame flex-shrink-0"
          style={{ width: pageSize.width * previewScale, height: pageSize.height * previewScale }}
        >
        <div
          ref={printRef}
          className="certificate-preview-page"
          style={{ width: '210mm', minHeight: '297mm', transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
        >
          {isBlotter ? (
            <BlotterReport request={request} />
          ) : isIndigency ? (
            <IndigencyCertificate certData={certData} updateField={updateField} isDownloading={isDownloading} />
          ) : isClearance ? (
            <ClearanceCertificate certData={certData} updateField={updateField} isDownloading={isDownloading} />
          ) : isBadac ? (
            <BadacCertificate certData={certData} updateField={updateField} isDownloading={isDownloading} />
          ) : (
            <ResidenceCertificate certData={certData} updateField={updateField} isDownloading={isDownloading} />
          )}
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
