const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

content = content.replace(
  `      if (status === 'approved') {
         setSuccessMessage(\`Request Approved Successfully.\${emailWarning}\`); setTimeout(() => { if(status === 'disapproved') { onClose(); } }, 2000);
      } else if (status === 'disapproved') {
         setSuccessMessage(\`Request Disapproved Successfully.\${emailWarning}\`); setTimeout(() => { if(status === 'disapproved') { onClose(); } }, 2000);
         onClose();
      } else if (status === 'completed') {
         setSuccessMessage(\`Request Completed Successfully.\${emailWarning}\`); setTimeout(() => { if(status === 'disapproved') { onClose(); } }, 2000);
      }`,
  `      if (status === 'approved') {
         setSuccessMessage(\`Request Approved Successfully.\${emailWarning}\`); setTimeout(() => { onClose(); }, 2000);
      } else if (status === 'disapproved') {
         setSuccessMessage(\`Request Disapproved Successfully.\${emailWarning}\`); setTimeout(() => { onClose(); }, 2000);
      } else if (status === 'completed') {
         setSuccessMessage(\`Request Completed Successfully.\${emailWarning}\`); setTimeout(() => { onClose(); }, 2000);
      }`
);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
