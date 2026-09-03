import React from 'react';
import { InlineInput } from './InlineInput';

export function IndigencyCertificate({ certData, updateField, isDownloading }: { certData: any, updateField: any, isDownloading: boolean }) {
  return (
    <div 
      className="bg-white text-black relative mx-auto origin-top certificate-a4"
      style={{ 
        width: '210mm', 
        height: '297mm',
        padding: '25.4mm', // 1 inch margins
        fontFamily: '"Times New Roman", Times, serif',
        boxSizing: 'border-box'
      }}
    >
      {/* Decorative Border */}
      <div className="absolute inset-[12mm] border-[3px] border-[#1e3a8a] pointer-events-none z-20">
        <div className="absolute inset-[2px] border-[1px] border-[#1e3a8a]"></div>
        {/* Corners */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-[4px] border-l-[4px] border-[#1e3a8a] bg-white"></div>
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-[4px] border-r-[4px] border-[#1e3a8a] bg-white"></div>
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-[4px] border-l-[4px] border-[#1e3a8a] bg-white"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-[4px] border-r-[4px] border-[#1e3a8a] bg-white"></div>
      </div>
      
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
         <img src="/logo_barangay.png" alt="" className="w-[180mm] h-[180mm] object-contain opacity-[0.06]" />
      </div>
      
      {/* Content Wrapper */}
      <div className="relative z-10 h-full flex flex-col pt-[2mm] px-[10mm] pb-[5mm]">
        
        {/* Header */}
        <div className="flex flex-row items-start justify-between mb-2">
          {/* Left Logo */}
          <div className="w-[30mm] h-[30mm] flex items-center justify-center shrink-0">
             <img src="/logo_city.png" alt="City Logo" className="w-full h-full object-contain" />
          </div>
          
          {/* Center Text */}
          <div className="flex-1 text-center px-2 leading-[1.3] text-[#1e3a8a]">
            <div className="text-[17px]">Republic of the Philippines</div>
            <div className="text-[17px]">Province of Samar</div>
            <div className="text-[20px]">CITY OF CATBALOGAN</div>
            <div className="font-bold text-[22px] tracking-wide">BARANGAY PUPUA</div>
          </div>

          {/* Right Logo */}
          <div className="w-[30mm] h-[30mm] flex items-center justify-center shrink-0">
            <img src="/logo_barangay.png" alt="Barangay Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="w-full border-b-[2px] border-[#1e3a8a] my-4"></div>

        <div className="text-center mb-10 text-[#1e3a8a] font-bold text-[19px] tracking-wide">
          OFFICE OF THE BARANGAY COUNCIL
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 
            className="text-[54px] tracking-wide whitespace-nowrap text-[#1e3a8a]"
            style={{ fontFamily: "'UnifrakturMaguntia', cursive" }}
          >
            Certificate of Indigency
          </h1>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-[20px] text-[18px] leading-[1.4] text-justify px-4">
          <p className="font-bold mb-4">TO WHOM IT MAY CONCERN:</p>
          
          <p>
            This is to certify that, <InlineInput value={certData.name} onChange={(v: string) => updateField('name', v)} minChars={35} isExporting={isDownloading} />, of legal age, Filipino,{' '}
            <InlineInput value={certData.maritalStatus} onChange={(v: string) => updateField('maritalStatus', v)} minChars={15} isExporting={isDownloading} /> (Marital Status), and a resident of Purok <InlineInput value={certData.purok} onChange={(v: string) => updateField('purok', v)} minChars={8} isExporting={isDownloading} />, Barangay Pupua,{' '}
            Catbalogan City, Samar, Philippines, and <InlineInput value={certData.pronoun} onChange={(v: string) => updateField('pronoun', v)} minChars={6} isExporting={isDownloading} /> is one of the <span className="font-bold">INDIGENT</span>{' '}
            families in the barangay.
          </p>
          
          <p>
            <span className="font-bold">THIS CERTIFICATE</span> is being issued upon the request of the above-mentioned{' '}
            name for whatever purpose it may serve.
          </p>

          <p>
            <span className="font-bold">ISSUED</span> this <InlineInput value={certData.day} onChange={(v: string) => updateField('day', v)} minChars={6} isExporting={isDownloading} /> day of <InlineInput value={certData.month} onChange={(v: string) => updateField('month', v)} minChars={20} isExporting={isDownloading} />, 20<InlineInput value={certData.year} onChange={(v: string) => updateField('year', v)} minChars={4} isExporting={isDownloading} /> at the Barangay Pupua,{' '}
            Catbalogan City, Samar, Philippines.
          </p>
        </div>

        {/* Signatures */}
        <div className="mt-12 flex justify-between w-full px-4 relative">
          <div className="flex flex-col items-start w-1/2">
            <p className="italic mb-12">Prepared by:</p>
            
            <div className="text-left">
              <div className="w-full border-b-[1.5px] border-black mb-1"></div>
              <div className="font-bold text-[18px] uppercase">NEIL G. LIAD</div>
              <p className="text-[17px] italic">Barangay Secretary</p>
            </div>
            
            <p className="italic text-[19px] font-serif mt-12">Barangay seal.</p>
          </div>

          <div className="flex flex-col items-center w-1/2 mt-20">
            <p className="mb-12 self-start pl-8">Certified by:</p>
            
            <div className="text-center w-full pl-8">
              <div className="w-full border-b-[1.5px] border-black mb-1"></div>
              <div className="font-bold text-[18px] uppercase">HON. ELPIDIO D. DIOCTON</div>
              <p className="text-[17px] italic">Punong Barangay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
