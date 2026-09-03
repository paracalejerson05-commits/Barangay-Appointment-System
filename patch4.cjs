const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

content = content.replace(
  `                )}
              </div>
            </>`,
  `                )}
              </div>
              </div>
            </>`
);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
