import React from 'react';
import { InlineInput } from './InlineInput';

export function ResidenceCertificate({ certData, updateField, isDownloading }: { certData: any, updateField: any, isDownloading: boolean }) {
  return (
    <div 
      className="bg-white text-black shadow-2xl relative print:shadow-none mx-auto origin-top certificate-a4"
      style={{ 
        width: '210mm', 
        height: '297mm',
        padding: '25.4mm', // 1 inch margins
        fontFamily: '"Times New Roman", Times, serif',
        boxSizing: 'border-box'
      }}
    >
      {/* Certificate Border - Exact thin dark border */}
      <div className="absolute inset-[12mm] border-[1px] border-[#1F2937] pointer-events-none z-20"></div>
      
      {/* Background Watermark - Faint City Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
         <img src="/logo_city.png" alt="" className="w-[160mm] h-[160mm] object-contain opacity-[0.06]" />
      </div>
      
      {/* Content Wrapper */}
      <div className="relative z-10 h-full flex flex-col pt-[5mm] px-[15mm] pb-[10mm]">
        
        {/* Header */}
        <div className="flex flex-row items-center justify-between mb-4">
          {/* Left Logo - Catbalogan City */}
          <div className="w-[28mm] h-[28mm] flex items-center justify-center shrink-0">
             <img src="/logo_city.png" alt="City Logo" className="w-full h-full object-contain" />
          </div>
          
          {/* Center Text */}
          <div className="flex-1 text-center px-4 leading-[1.35]">
            <div className="text-[17px]">Republic of the Philippines</div>
            <div className="text-[17px]">Province of Samar</div>
            <div className="font-bold text-[19px]">CATBALOGAN CITY</div>
            <div className="font-bold text-[19px]">Barangay Pupua</div>
            <div className="font-bold text-[21px] mt-2 uppercase">OFFICE OF THE PUNONG BARANGAY</div>
          </div>

          {/* Right Logo - Barangay Pupua */}
          <div className="w-[28mm] h-[28mm] flex items-center justify-center shrink-0">
            <img src="/logo_barangay.png" alt="Barangay Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="w-full border-b-[1.5px] border-[#1F2937] mb-12"></div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 
            className="text-[54px] tracking-wide whitespace-nowrap"
            style={{ fontFamily: "'UnifrakturMaguntia', cursive" }}
          >
            Residence Certificate
          </h1>
        </div>

        <div className="mb-4">
          <p className="text-[18px]">To whom it may concern:</p>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-[14px] text-[18px] leading-[1.3] text-justify px-2">
          <p>
            <span className="font-bold">This is to certify</span> that, <InlineInput value={certData.name} onChange={(v: string) => updateField('name', v)} minChars={35} isExporting={isDownloading} />,{' '}
            <InlineInput value={certData.age} onChange={(v: string) => updateField('age', v)} minChars={5} isExporting={isDownloading} /> years old, Filipino, and a permanent resident of Purok <InlineInput value={certData.purok} onChange={(v: string) => updateField('purok', v)} minChars={12} isExporting={isDownloading} />,{' '}
            Barangay Pupua, Catbalogan City, Samar, Philippines.
          </p>
          
          <p>
            <span className="font-bold">CERTIFY FURTHER</span> that the above-mentioned individual has been{' '}
            residing in this barangay for <InlineInput value={certData.years} onChange={(v: string) => updateField('years', v)} minChars={6} isExporting={isDownloading} /> years now up to this present date,{' '}
            and is known to be of <span className="font-bold">good moral character</span>, a law-abiding citizen,{' '}
            and has <span className="font-bold">no derogatory records</span> filed in this office as of this date.
          </p>

          <p>
            <span className="font-bold">This certification</span> is being issued upon the request of the interested{' '}
            party for whatever purpose it may serve.
          </p>

          <p>
            <span className="font-bold">Issued</span> this <InlineInput value={certData.day} onChange={(v: string) => updateField('day', v)} minChars={6} isExporting={isDownloading} /> day of <InlineInput value={certData.month} onChange={(v: string) => updateField('month', v)} minChars={20} isExporting={isDownloading} />, 20<InlineInput value={certData.year} onChange={(v: string) => updateField('year', v)} minChars={4} isExporting={isDownloading} /> at Barangay{' '}
            Pupua, Catbalogan City, Samar, Philippines.
          </p>
        </div>

        {/* Signature Area */}
        <div className="mt-8 flex flex-col items-start w-full relative pl-2">
          <p className="mb-10">Certified by:</p>
          
          <div className="text-left relative z-10">
            <div className="w-full border-b-[1.5px] border-black mb-1"></div>
            <div className="font-bold text-[18px] uppercase text-left w-auto min-w-[250px] px-0">HON. ELPIDIO D. DIOCTON</div>
            <p className="text-[17px] text-left">Punong Barangay</p>
          </div>
          
          {/* Seal Area */}
          <div className="absolute bottom-0 right-4">
            <p className="italic text-[19px] font-serif">Barangay Seal.</p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
