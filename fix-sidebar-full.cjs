const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldSidebarStart = content.indexOf('      {/* Sidebar */}');
const oldSidebarEnd = content.indexOf('      </aside>') + 14;

const newSidebar = `      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 lg:inset-y-4 lg:left-4 z-50 bg-[#15418C] text-white transition-all duration-300 ease-in-out shadow-xl",
          isDesktopCollapsed ? "lg:w-20" : "lg:w-64",
          isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0",
          "lg:rounded-[20px] rounded-r-[20px]"
        )}
      >
        <div className="h-full flex flex-col p-4 relative">
          
          {/* Collapse/Expand Toggle (Desktop only) */}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="hidden lg:flex absolute -right-3 top-6 bg-white text-[#15418C] w-7 h-7 rounded-full items-center justify-center shadow-md border border-gray-100 cursor-pointer z-50 hover:bg-gray-50 transition-colors"
          >
            {isDesktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute right-4 top-6 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            {/* Logo & Brand Header */}
            <Link to="/" className={cn(
              "flex items-center gap-3 pb-6 mb-2 border-b border-white/10",
              isDesktopCollapsed ? "justify-center" : "px-2"
            )}>
              <div className="h-10 w-10 flex items-center justify-center flex-shrink-0 relative">
                <div className="absolute inset-0 bg-white rounded-full opacity-10"></div>
                <img 
                  src={BARANGAY_LOGO_URL} 
                  alt="Logo" 
                  className="h-full w-full object-contain drop-shadow-md relative z-10 bg-white rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xl tracking-tighter">RD</span>';
                  }}
                />
              </div>
              <div className={cn("flex flex-col min-w-0 transition-opacity duration-200", isDesktopCollapsed && "hidden")}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  SMART PORTAL
                </span>
                <span className="font-bold text-white text-[15px] leading-tight truncate tracking-wide">
                  {SYSTEM_NAME || 'Barangay Pupua'}
                </span>
              </div>
            </Link>

            {/* Nav Menu */}
            <nav className="space-y-1.5 mt-4">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isDesktopCollapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    "flex items-center px-3.5 py-3 rounded-[12px] font-medium text-[13px] transition-all duration-200 group relative",
                    isActive 
                      ? "bg-white/15 text-white shadow-inner font-semibold" 
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <div className={cn(
                        "flex items-center justify-center flex-shrink-0 transition-transform duration-200",
                        isDesktopCollapsed ? "mx-auto" : "mr-3",
                        isActive ? "scale-110" : "group-hover:scale-110"
                      )}>
                        <item.icon className="w-5 h-5 stroke-[2]" />
                      </div>
                      
                      <span className={cn(
                        "tracking-wide whitespace-nowrap transition-opacity duration-200",
                        isDesktopCollapsed ? "hidden" : "block opacity-100"
                      )}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Bottom Actions */}
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
          </div>
        </div>
      </aside>`;

if (oldSidebarStart !== -1 && oldSidebarEnd !== -1) {
  content = content.substring(0, oldSidebarStart) + newSidebar + content.substring(oldSidebarEnd);
  // Remove unused import
  content = content.replace("  HelpCircle\n", "");
  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Done');
} else {
  console.log('Could not find sidebar bounds');
}
