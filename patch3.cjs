const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// Replace the previous confirm removed comment with actual custom confirmation logic
const modalStart = `  const [isUpdating, setIsUpdating] = useState(false);
  const [showCertificateEditor, setShowCertificateEditor] = useState(false);`;

const newModalStart = `  const [isUpdating, setIsUpdating] = useState(false);
  const [showCertificateEditor, setShowCertificateEditor] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'approved' | 'disapproved' | 'completed'>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');`;

content = content.replace(modalStart, newModalStart);

const handleUpdateStatusStart = `  const handleUpdateStatus = async (status: 'approved' | 'disapproved' | 'completed') => {`;

const newHandleUpdateStatusStart = `  const handleUpdateStatus = async (status: 'approved' | 'disapproved' | 'completed') => {
    if (confirmAction !== status) {
      setConfirmAction(status);
      setErrorMessage('');
      return;
    }`;

content = content.replace(handleUpdateStatusStart, newHandleUpdateStatusStart);

// Remove the // Confirmation removed comment block
content = content.replace(/\/\/ Confirmation removed for iframe compatibility/g, '');

content = content.replace(/console\.log\(\`Request (Approved|Disapproved|Completed) Successfully\.\$\{emailWarning\}\`\);/g, 'setSuccessMessage(`Request $1 Successfully.${emailWarning}`); setTimeout(() => { if(status === \'disapproved\') { onClose(); } }, 2000);');

content = content.replace(/alert\("Failed to update request. Error: " \+ \(error instanceof Error \? error.message : JSON.stringify\(error\)\)\);/g, 'setErrorMessage("Failed to update request: " + (error instanceof Error ? error.message : "Unknown error")); setConfirmAction(null);');

content = content.replace(/console\.warn\("This request has already been processed."\);/g, 'setErrorMessage("This request has already been processed."); setConfirmAction(null);');
content = content.replace(/console\.warn\("Only approved requests can be marked as completed."\);/g, 'setErrorMessage("Only approved requests can be marked as completed."); setConfirmAction(null);');

// Now inject the UI for error and confirm messages before the buttons
const buttonsStart = `<div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-end gap-2 flex-shrink-0">`;
const newButtonsStart = `<div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col flex-shrink-0">
  {errorMessage && <div className="text-red-600 text-xs mb-3 text-right bg-red-50 p-2 rounded">{errorMessage}</div>}
  {successMessage && <div className="text-green-600 text-xs mb-3 text-right bg-green-50 p-2 rounded">{successMessage}</div>}
  {confirmAction && !isUpdating && !successMessage && (
    <div className="text-amber-700 text-xs mb-3 text-right bg-amber-50 p-2 rounded flex justify-between items-center">
      <span>Are you sure you want to <b>{confirmAction}</b> this request?</span>
      <button onClick={() => setConfirmAction(null)} className="underline text-gray-500 hover:text-gray-700">Cancel</button>
    </div>
  )}
  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 w-full">`;

content = content.replace(buttonsStart, newButtonsStart);

// Add the closing div for the flex container
const buttonsEnd = `</button>
                  </>
                )}
              </div>`;
const newButtonsEnd = `</button>
                  </>
                )}
              </div>
            </div>`;
// Actually, since I have a match on the closing tag, let's just use string replacement carefully
const oldButtonsEndBlock = `              <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-end gap-2 flex-shrink-0">`;

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
