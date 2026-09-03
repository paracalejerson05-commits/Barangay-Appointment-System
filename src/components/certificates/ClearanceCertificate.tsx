import React from 'react';
import { InlineInput } from './InlineInput';

export function ClearanceCertificate({ certData, updateField, isDownloading }: { certData: any, updateField: any, isDownloading: boolean }) {
  return (
    <div 
      className="bg-white text-black relative mx-auto origin-top certificate-a4"
      style={{ 
        width: '210mm', 
        height: '297mm',
        padding: '25.4mm', // 1 inch margins
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box'
      }}
    >
      {/* Content Wrapper */}
      <div className="relative z-10 h-full flex flex-col pt-[5mm] px-[10mm] pb-[5mm]">
        
        {/* Header */}
        <div className="flex flex-row items-start justify-between mb-2">
          {/* Left Logo */}
          <div className="w-[30mm] h-[30mm] flex items-center justify-center shrink-0">
             <img src="/logo_city.png" alt="City Logo" className="w-full h-full object-contain" />
          </div>
          
          {/* Center Text */}
          <div className="flex-1 text-center px-2 leading-[1.25]">
            <div className="text-[17px]">Republic of the Philippines</div>
            <div className="text-[17px]">Province of Samar</div>
            <div className="font-bold text-[19px]">CATBALOGAN CITY</div>
            <div className="font-bold text-[19px]">Barangay Pupua</div>
            <div className="font-bold text-[22px] mt-6 uppercase">OFFICE OF THE PUNONG BARANGAY</div>
          </div>

          {/* Right Logo */}
          <div className="w-[30mm] h-[30mm] flex items-center justify-center shrink-0">
            <img src="/logo_barangay.png" alt="Barangay Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="w-full border-b-[2px] border-black my-6"></div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-[42px] font-bold tracking-wide whitespace-nowrap text-black">
            Barangay Clearance
          </h1>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-[24px] text-[18px] leading-[1.6] text-justify px-2">
          <p>To whom it may concern:</p>
          
          <p>
            <span className="font-bold">THIS IS TO CERTIFY</span> that, (Name) <InlineInput value={certData.name} onChange={(v: string) => updateField('name', v)} minChars={35} isExporting={isDownloading} />, Filipino,{' '}
            <InlineInput value={certData.age} onChange={(v: string) => updateField('age', v)} minChars={3} isExporting={isDownloading} /> years of legal age, (Marital Status) <InlineInput value={certData.maritalStatus} onChange={(v: string) => updateField('maritalStatus', v)} minChars={15} isExporting={isDownloading} />, and a Bonafide resident{' '}
            of Purok <InlineInput value={certData.purok} onChange={(v: string) => updateField('purok', v)} minChars={3} isExporting={isDownloading} /> Barangay Pupua Catbalogan City, Samar, and that She/He is of{' '}
            good moral character and being a law-abiding citizen.
          </p>
          
          <p>
            This certification is being issued upon the request of the interested party{' '}
            for whatever legal purpose it may serve.
          </p>

          <p>
            <span className="font-bold">ISSUED</span> this <InlineInput value={certData.day} onChange={(v: string) => updateField('day', v)} minChars={4} isExporting={isDownloading} /> day of {certData.month} {certData.fullYear}, at Barangay Pupua, Catbalogan City.
          </p>
        </div>

        {/* Signatures */}
        <div className="mt-16 flex flex-col items-start w-full px-2">
          <p className="italic mb-6">Certified by:</p>
          <p className="mb-14">By the authority of the Punong Barangay:</p>
            
          <div className="text-left">
            <div className="font-bold text-[19px] underline underline-offset-4">HON. MARIEVELOUI P. DIOCTON</div>
            <p className="text-[17px] italic mt-1">Sangguniang Barangay Member (D/C)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
