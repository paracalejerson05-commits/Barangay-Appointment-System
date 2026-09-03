import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { XCircle, Printer, Save, Download, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ResidenceCertificate } from './certificates/ResidenceCertificate';
import { IndigencyCertificate } from './certificates/IndigencyCertificate';
import { ClearanceCertificate } from './certificates/ClearanceCertificate';
import { BadacCertificate } from './certificates/BadacCertificate';

interface CertificateEditorProps {
  request: any;
  onClose: () => void;
  onComplete?: () => void;
}

export default function CertificateEditor({ request, onClose, onComplete }: CertificateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const isIndigency = request.serviceType === 'Certificate of Indigency';
  const isClearance = request.serviceType === 'Barangay Clearance';
  const isBadac = request.serviceType === 'BADAC Clearance';

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'serviceRequests', request.id), {
        certificateData: certData
      });
    } catch (error) {
      console.error("Error saving certificate:", error);
      alert("Failed to save certificate changes.");
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
    await handleSave();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    await handleSave();
    
    // Add temporary class to bypass UI scroll limits and hide UI colors
    document.body.classList.add('is-exporting-pdf');
    const container = printRef.current;
    
    // Force container to be fully visible for html2canvas
    container.style.transform = 'none';
    
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(container, {
          scale: 2, 
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: container.offsetWidth,
          height: container.offsetHeight,
          windowHeight: container.offsetHeight + 100 // ensure full height is captured
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        // A4 dimensions in mm
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${request.serviceType || 'Certificate'}_${request.residentName.replace(/\s+/g, '_')}.pdf`);
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF. Please try again.");
      } finally {
        // Cleanup
        document.body.classList.remove('is-exporting-pdf');
        setIsDownloading(false);
      }
    }, 500); // 500ms delay to allow DOM to strictly re-render without inputs
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-white pdf-hide-bg">
      {/* Sidebar Controls */}
      <div className="w-[320px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col pdf-hidden z-10 h-full font-sans">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="font-bold text-[#0F172A]">Certificate Editor</h3>
          <p className="text-xs text-[#64748B]">Review and edit before printing</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs border border-blue-100">
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

        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-2">
          <button onClick={handleDownloadPDF} disabled={isDownloading} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#E2E8F0] rounded-[6px] text-[#0F172A] font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          
          <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] font-semibold text-sm transition-colors shadow-sm">
            <Printer className="w-4 h-4" />
            Print Certificate
          </button>

          <button onClick={onClose} className="w-full mt-4 py-2 px-4 text-[#64748B] hover:text-[#0F172A] text-sm transition-colors">
            Cancel & Close
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-auto bg-[#F1F5F9] flex items-start justify-center p-8 print:p-0 print:bg-white pdf-print-container">
        <div ref={printRef}>
          {isIndigency ? (
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
  );
}
