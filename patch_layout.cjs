const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// 1. Add missing imports
if (!content.includes('ChevronLeft')) {
  content = content.replace(
    "} from 'lucide-react';",
    "  ChevronLeft,\n  ChevronRight,\n  HelpCircle\n} from 'lucide-react';"
  );
}

// 2. We need a state for desktop collapse
if (!content.includes('const [isDesktopCollapsed, setIsDesktopCollapsed]')) {
  content = content.replace(
    '  const [isSidebarOpen, setIsSidebarOpen] = useState(true);',
    '  const [isSidebarOpen, setIsSidebarOpen] = useState(false);\n  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);'
  );
}

// 3. Update the menu arrays. The user explicitly wants Help Center and Sign Out at the bottom for Admin (though sign out is handled separately). For Admin, the prompt lists exactly what it should be.
// But wait, the exact resident menu items must be kept as well.
// Let's just update the rendering of the Sidebar.

const oldSidebar = `      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-4 left-4 z-50 w-64 bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] transition-all duration-300 ease-in-out lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col justify-between p-5">
          <div>
            {/* Logo & Brand Header */}
            <Link to="/" className="flex items-center gap-3 pb-5 border-b border-[#E5E7EB]">
              <div className="h-10 w-10 flex items-center justify-center bg-[#F8FAFC] p-1 rounded-[10px] border border-[#E5E7EB] overflow-hidden flex-shrink-0">
                <img 
                  src={BARANGAY_LOGO_URL} 
                  alt="Barangay Logo" 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = BARANGAY_LOGO_FALLBACK;
                  }}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                  Smart Portal
                </span>
                <span className="font-bold text-[#111827] text-sm leading-tight truncate">
                  Barangay Pupua
                </span>
              </div>
            </Link>

            {/* Nav Menu */}
            <nav className="mt-5 space-y-1">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider px-3 mb-2">
                Navigation
              </p>
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] font-medium text-sm transition-colors duration-150 group",
                    isActive 
                      ? "bg-blue-50 text-[#2563EB] font-semibold" 
                      : "text-[#6B7280] hover:bg-[#F8FAFC] hover:text-[#111827]"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn(
                        "w-4 h-4 transition-colors",
                        isActive ? "text-[#2563EB]" : "text-[#6B7280] group-hover:text-[#111827]"
                      )} />
                      <span className="tracking-tight">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* User Status Card & Logout */}
          <div className="space-y-2.5 pt-4 border-t border-[#E5E7EB]">
            <div className="p-3 bg-[#F8FAFC] rounded-[12px] border border-[#E5E7EB] flex items-center gap-3">
              <img 
                src={user.photoURL || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(profile?.displayName || user.displayName || 'Resident')}&background=2563EB&color=fff\`} 
                alt="Profile" 
                className="w-8 h-8 rounded-[8px] border border-[#E5E7EB] object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#111827] truncate">
                  {profile?.displayName || user.displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("w-2 h-2 rounded-full", isAdmin ? "bg-[#2563EB]" : "bg-emerald-500")} />
                  <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">
                    {profile?.role || 'Resident'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-red-600 hover:bg-red-50 rounded-[10px] font-medium text-xs transition-colors border border-transparent hover:border-red-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>`;

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
                {/* Fallback to simple RD logo style if real logo fails to look good on blue, but we use real logo as requested */}
                <div className="absolute inset-0 bg-white rounded-full opacity-10"></div>
                <img 
                  src={BARANGAY_LOGO_URL} 
                  alt="Logo" 
                  className="h-full w-full object-contain drop-shadow-md relative z-10"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target).style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xl tracking-tighter">RD</span>';
                  }}
                />
              </div>
              <div className={cn("flex flex-col min-w-0 transition-opacity duration-200", isDesktopCollapsed && "hidden")}>
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
          <div className="pt-4 mt-2 border-t border-white/10 space-y-1.5">
            {isAdmin && (
              <NavLink
                to="/help"
                title={isDesktopCollapsed ? "Help Center" : undefined}
                className={({ isActive }) => cn(
                  "flex items-center px-3.5 py-3 rounded-[12px] font-medium text-[13px] transition-all duration-200 group",
                  isActive 
                    ? "bg-white/15 text-white font-semibold" 
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center flex-shrink-0",
                  isDesktopCollapsed ? "mx-auto" : "mr-3"
                )}>
                  <HelpCircle className="w-5 h-5 stroke-[2]" />
                </div>
                <span className={cn("tracking-wide whitespace-nowrap", isDesktopCollapsed && "hidden")}>
                  Help Center
                </span>
              </NavLink>
            )}

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

if (content.includes('      {/* Sidebar */}')) {
  // Use index-based replacement in case of small formatting differences
  const parts = content.split('      {/* Sidebar */}');
  const tail = parts[1].split('      </aside>');
  if (tail.length > 1) {
    content = parts[0] + newSidebar + tail.slice(1).join('      </aside>');
  }
}

// 4. Update the Main Content layout classes to account for the new sidebar sizes
const oldMainContentClass = `      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "lg:ml-68" : "ml-0"
      )}>`;

const newMainContentClass = `      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
        isDesktopCollapsed ? "lg:ml-24" : "lg:ml-72"
      )}>`;

content = content.replace(oldMainContentClass, newMainContentClass);

fs.writeFileSync('src/components/Layout.tsx', content);

