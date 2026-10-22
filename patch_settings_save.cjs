const fs = require('fs');
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const newSave = `
      const profileFields = {
        displayName: profileData.fullName || '',
        email: profileData.email || user?.email || '',
        contactNumber: profileData.contactNumber || '',
        address: profileData.address || '',
        barangay: profileData.barangay || 'Pupua',
        city: profileData.city || 'Catbalogan City',
        province: profileData.province || 'Samar',
        age: profileData.age ? Number(profileData.age) : null,
        gender: profileData.gender || 'Male',
        civilStatus: profileData.civilStatus || 'Single',
        photoURL: previewImage || null,
        updatedAt: serverTimestamp()
      };
`;

code = code.replace(/const profileFields = \{[\s\S]*?updatedAt: serverTimestamp\(\)\s*\};/, newSave.trim());
fs.writeFileSync('src/components/Settings.tsx', code);
