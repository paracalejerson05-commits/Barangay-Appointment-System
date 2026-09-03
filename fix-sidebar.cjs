const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const replacement = `          {/* Bottom Actions */}
          <div className="pt-4 mt-2 border-t border-white/10 space-y-2">
            
            {/* User Status Card */}
            <div className={cn(
              "flex items-center gap-3 border border-white/20 rounded-[12px] transition-all duration-200 overflow-hidden",
              isDesktopCollapsed ? "p-1.5 justify-center border-transparent" : "p-2.5"
            )}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className={cn(
                    "rounded-[8px] object-cover flex-shrink-0 bg-white/10",
                    isDesktopCollapsed ? "w-8 h-8" : "w-10 h-10"
                  )}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={cn(
                  "bg-[#2563EB] text-white flex items-center justify-center rounded-[8px] font-bold flex-shrink-0",
                  isDesktopCollapsed ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
                )}>
                  {profile?.displayName?.substring(0, 2)?.toUpperCase() || user.displayName?.substring(0, 2)?.toUpperCase() || 'AL'}
                </div>
              )}
              
              <div className={cn("min-w-0 flex-1 transition-opacity duration-200", isDesktopCollapsed && "hidden")}>
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.displayName || user.displayName || 'Resident'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", isAdmin ? "bg-amber-400" : "bg-emerald-400")} />
                  <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">
                    {profile?.role || 'Resident'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title={isDesktopCollapsed ? "Sign Out" : undefined}
              className={cn(
                "w-full flex items-center px-3.5 py-3 text-white/80 hover:bg-white/10 hover:text-white rounded-[12px] font-medium text-[13px] transition-all duration-200 cursor-pointer group"
              )}
            >
              <div className={cn(
                "flex items-center justify-center flex-shrink-0",
                isDesktopCollapsed ? "mx-auto" : "mr-3"
              )}>
                <LogOut className="w-5 h-5 stroke-[2]" />
              </div>
              <span className={cn("tracking-wide whitespace-nowrap", isDesktopCollapsed && "hidden")}>
                Sign Out
              </span>
            </button>
          </div>`;

// Find the start of the bottom actions
const startIdx = content.indexOf('          {/* Bottom Actions */}');
const endIdx = content.indexOf('        </div>', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + replacement + '\n' + content.substring(endIdx);
  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Sidebar updated');
} else {
  console.log('Could not find replace range');
}

