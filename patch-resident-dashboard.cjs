const fs = require('fs');
let content = fs.readFileSync('src/components/ResidentDashboard.tsx', 'utf8');

// Add announcements to useSchedule hook
content = content.replace(
  'const { schedule, getRecommendation } = useSchedule();',
  'const { schedule, getRecommendation, announcements } = useSchedule();'
);

// Replace BARANGAY ANNOUNCEMENTS section
const announcementsStart = content.indexOf('{/* BARANGAY ANNOUNCEMENTS */}');
const announcementsEnd = content.indexOf('{/* OFFICE INFORMATION */}');

const newAnnouncementsUI = `{/* BARANGAY ANNOUNCEMENTS */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  BARANGAY ANNOUNCEMENTS
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-[#64748B]">
                Official Notice
              </span>
            </div>
            
            <div className="space-y-2.5 pt-1">
              {(() => {
                const publishedAnnouncements = (announcements || [])
                  .filter((ann: any) => ann.status === 'Published')
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                if (publishedAnnouncements.length === 0) {
                  return (
                    <div className="p-4 text-center">
                      <p className="text-xs text-[#64748B] italic">No announcements available at this time.</p>
                    </div>
                  );
                }

                // Show only top 2 by default
                return publishedAnnouncements.slice(0, 2).map((ann: any) => (
                  <div key={ann.id} className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#0F172A]">{ann.title}</h4>
                      <span className="text-[10px] text-[#64748B] whitespace-nowrap ml-2">
                        {new Date(ann.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {ann.category && (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mb-1">
                        {ann.category}
                      </span>
                    )}
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {ann.content || ann.message}
                    </p>
                  </div>
                ));
              })()}
            </div>
            
            <div className="pt-1 text-right">
              <button
                onClick={() => {
                  alert("View all published announcements coming soon!");
                }}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All Announcements</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          `;

content = content.substring(0, announcementsStart) + newAnnouncementsUI + content.substring(announcementsEnd);

fs.writeFileSync('src/components/ResidentDashboard.tsx', content);
console.log('ResidentDashboard updated.');
