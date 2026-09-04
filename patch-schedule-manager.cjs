const fs = require('fs');

let content = fs.readFileSync('src/components/ScheduleManager.tsx', 'utf8');

// Add Edit2 and FileEdit to imports
content = content.replace('Trash2,', 'Trash2,\n  Edit2,\n  FileEdit,');
content = content.replace("updateDoc,", "updateDoc,\n  deleteDoc,");
if (!content.includes('updateDoc')) {
    content = content.replace("deleteDoc,", "deleteDoc,\n  updateDoc,");
}

// Replace state
content = content.replace(
  "const [newAnnouncement, setNewAnnouncement] = useState('');",
  `const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    category: 'General',
    status: 'Published'
  });`
);

// Replace handleAddAnnouncement and handleDeleteAnnouncement
const oldHandlersStart = content.indexOf('const handleAddAnnouncement = async () => {');
const oldHandlersEnd = content.indexOf('const getCurrentTime = () => {');
const newHandlers = `
  const handleOpenAnnouncementModal = (ann?: any) => {
    if (ann) {
      setCurrentAnnouncement({
        id: ann.id,
        title: ann.title || '',
        content: ann.content || ann.message || '',
        date: ann.date || new Date().toISOString().split('T')[0],
        category: ann.category || 'General',
        status: ann.status || 'Published'
      });
    } else {
      setCurrentAnnouncement({
        title: '',
        content: '',
        date: new Date().toISOString().split('T')[0],
        category: 'General',
        status: 'Published'
      });
    }
    setIsAnnouncementModalOpen(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!currentAnnouncement.title.trim() || !currentAnnouncement.content.trim()) return;
    try {
      if ((currentAnnouncement as any).id) {
        await updateDoc(doc(db, 'announcements', (currentAnnouncement as any).id), {
          title: currentAnnouncement.title,
          content: currentAnnouncement.content,
          date: currentAnnouncement.date,
          category: currentAnnouncement.category,
          status: currentAnnouncement.status,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'announcements'), {
          title: currentAnnouncement.title,
          content: currentAnnouncement.content,
          date: currentAnnouncement.date,
          category: currentAnnouncement.category,
          status: currentAnnouncement.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsAnnouncementModalOpen(false);
    } catch (error) {
      console.error("Error saving announcement:", error);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      console.error("Error deleting announcement:", error);
    }
  };

  `;

content = content.substring(0, oldHandlersStart) + newHandlers + content.substring(oldHandlersEnd);

// Replace UI
const uiStart = content.indexOf('<div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">');
const uiEnd = content.indexOf('<div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">');

const newUI = `<div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900">Announcements</h3>
              </div>
              <button
                onClick={() => handleOpenAnnouncementModal()}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {announcements.length === 0 ? (
                  <p className="text-center py-8 text-neutral-400 text-sm italic">No announcements found.</p>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group relative flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-neutral-900 text-sm">{ann.title || 'Untitled'}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              ann.status === 'Published' ? "bg-green-50 text-green-600 border-green-200" :
                              ann.status === 'Draft' ? "bg-amber-50 text-amber-600 border-amber-200" :
                              "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {ann.status || 'Published'}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-semibold">{ann.category || 'General'}</span>
                            <span className="text-[10px] text-neutral-400">&bull; {ann.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenAnnouncementModal(ann)}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-600 pr-8">{ann.content || ann.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          `;

content = content.substring(0, uiStart) + newUI + content.substring(uiEnd);

// Add Modal
const endOfComponent = content.lastIndexOf('</div>\n  );\n}');
const modalCode = `
      {/* Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">
                {(currentAnnouncement as any).id ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Title</label>
                <input
                  type="text"
                  value={currentAnnouncement.title}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, title: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Barangay Office Schedule"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Date</label>
                  <input
                    type="date"
                    value={currentAnnouncement.date}
                    onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, date: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Category</label>
                  <input
                    type="text"
                    value={currentAnnouncement.category}
                    onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, category: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Advisory"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Status</label>
                <select
                  value={currentAnnouncement.status}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, status: e.target.value as any})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Content</label>
                <textarea
                  value={currentAnnouncement.content}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, content: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                  placeholder="Type the announcement details..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50">
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-6 py-2 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={!currentAnnouncement.title || !currentAnnouncement.content}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Announcement
              </button>
            </div>
          </motion.div>
        </div>
      )}
`;

content = content.substring(0, endOfComponent) + modalCode + content.substring(endOfComponent);

fs.writeFileSync('src/components/ScheduleManager.tsx', content);
console.log('ScheduleManager updated.');
