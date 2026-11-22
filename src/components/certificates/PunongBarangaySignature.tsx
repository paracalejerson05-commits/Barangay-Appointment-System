import React from 'react';

export function isPunongBarangaySignatory(signatoryName: string) {
  const normalizedName = signatoryName
    .toUpperCase()
    .replace(/^HON\.?\s+/, '')
    .replace(/\./g, '')
    .trim()
    .replace(/\s+/g, ' ');

  return /^ELPIDIO(?: D)? DIOCTON$/.test(normalizedName);
}

export function PunongBarangaySignature({
  signatoryName
}: {
  signatoryName: string;
}) {
  if (!isPunongBarangaySignatory(signatoryName)) return null;

  return (
    <div className="mx-auto flex w-[56mm] flex-col items-center">
      <img
        src="/punong-barangay-signature.png"
        alt=""
        aria-hidden="true"
        className="block h-[15mm] w-[42mm] object-contain"
      />
      <div aria-hidden="true" className="mb-[1mm] mt-[2mm] w-full border-t border-black" />
    </div>
  );
}
