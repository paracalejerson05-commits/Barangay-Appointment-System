import React from 'react';
import { getRequestReference } from '../../lib/requestPresentation';

export function BlotterReport({ request }: { request: any }) {
  const appointment = request.appointmentDate
    ? `${request.appointmentDate}${request.appointmentTime ? ` at ${request.appointmentTime}` : ''}`
    : 'Not specified';

  return (
    <div
      className="bg-white text-black relative mx-auto origin-top certificate-a4"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '25.4mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box'
      }}
    >
      <div className="absolute inset-[12mm] border border-black pointer-events-none" />
      <div className="relative z-10 h-full flex flex-col px-[10mm] py-[5mm]">
        <header className="flex items-center justify-between gap-5 text-center">
          <img src="/logo_city.png" alt="Catbalogan City seal" className="w-[28mm] h-[28mm] object-contain" />
          <div className="flex-1 leading-relaxed">
            <p>Republic of the Philippines</p>
            <p>Province of Samar</p>
            <p className="font-bold">CITY OF CATBALOGAN</p>
            <p className="font-bold">BARANGAY PUPUA</p>
            <p className="mt-2 font-bold">OFFICE OF THE PUNONG BARANGAY</p>
          </div>
          <img src="/logo_barangay.png" alt="Barangay Pupua seal" className="w-[28mm] h-[28mm] object-contain" />
        </header>

        <div className="border-b-2 border-black my-8" />
        <h1 className="text-center text-3xl font-bold tracking-wide">BARANGAY BLOTTER REPORT</h1>
        <p className="text-center text-sm mt-2">OFFICIAL INCIDENT RECORD</p>

        <section className="mt-12 space-y-5 text-base">
          <div className="grid grid-cols-2 gap-6 border-b border-gray-400 pb-3">
            <p><strong>Reference ID:</strong> {getRequestReference(request.id, request.createdAt)}</p>
            <p><strong>Filed:</strong> {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}</p>
          </div>
          <p><strong>Reporting Resident:</strong> {request.residentName || 'N/A'}</p>
          <p><strong>Appointment:</strong> {appointment}</p>
          <div className="min-h-[75mm] border border-gray-500 p-5">
            <h2 className="font-bold uppercase text-sm mb-3">Incident / Complaint Details</h2>
            <p className="whitespace-pre-wrap leading-relaxed">{request.description || 'No incident details were provided.'}</p>
          </div>
          <p className="leading-relaxed">
            This report is issued by Barangay Pupua for official recording and appropriate barangay action.
            The information above is based on the statement submitted by the reporting resident.
          </p>
        </section>

        <footer className="mt-auto pt-16 flex justify-end">
          <div className="w-[75mm] text-center">
            <div className="border-b border-black mb-2" />
            <p className="font-bold uppercase">HON. ELPIDIO D. DIOCTON</p>
            <p>Punong Barangay</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
