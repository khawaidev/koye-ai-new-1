const fs = require('fs');
const file = 'src/pages/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// Colors & Gradients - removing primary/blue colors, switching to sleek B&W glassmorphism
code = code.replace(/text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-500/g, 'text-foreground');
code = code.replace(/bg-gradient-to-br from-primary to-blue-600/g, 'bg-white/10');
code = code.replace(/bg-gradient-to-r from-primary to-blue-600/g, 'bg-white/10 text-foreground border border-white/10 hover:bg-white/20');
code = code.replace(/bg-primary\/20 blur-\[120px\]/g, 'bg-white/5 blur-[100px]');
code = code.replace(/bg-blue-500\/10 blur-\[100px\]/g, 'bg-white/5 blur-[100px]');
code = code.replace(/bg-primary\/10/g, 'bg-white/5 text-foreground');
code = code.replace(/bg-primary\/20/g, 'bg-white/5 text-foreground');
code = code.replace(/shadow-\[0_0_15px_rgba\(var\(--primary-rgb\),0\.5\)\]/g, 'shadow-sm text-foreground');
code = code.replace(/shadow-xl shadow-primary\/20/g, 'shadow-sm text-foreground');
code = code.replace(/shadow-lg shadow-primary\/20/g, 'shadow-sm text-foreground');
code = code.replace(/hover:border-primary\/20/g, 'hover:border-white/20');
code = code.replace(/hover:text-primary/g, 'hover:text-foreground');
code = code.replace(/border-primary\/20/g, 'border-white/10');
code = code.replace(/border-primary\/30/g, 'border-white/20');
code = code.replace(/border-t-primary/g, 'border-t-white');
code = code.replace(/border-primary/g, 'border-white/30');
code = code.replace(/text-primary-foreground/g, 'text-black');
code = code.replace(/bg-primary text-black/g, 'bg-white text-black hover:bg-white/90');
code = code.replace(/font-black text-primary/g, 'font-bold text-foreground');
code = code.replace(/font-bold text-primary/g, 'font-bold text-foreground');
code = code.replace(/text-primary/g, 'text-foreground');
code = code.replace(/bg-primary /g, 'bg-white text-black hover:bg-white/90 ');
code = code.replace(/"bg-primary"/g, '"bg-white text-black hover:bg-white/90"');
code = code.replace(/text-blue-400/g, 'text-foreground');
code = code.replace(/bg-blue-500\/10/g, 'bg-white/5');
code = code.replace(/text-white/g, 'text-foreground');
code = code.replace(/bg-gradient-to-br from-primary to-blue-600/g, 'bg-white text-black');
code = code.replace(/from-primary via-purple-500 to-blue-500/g, 'text-foreground');

// Sizes - downscaling
code = code.replace(/text-7xl/g, 'text-4xl');
code = code.replace(/text-6xl/g, 'text-3xl');
code = code.replace(/text-5xl/g, 'text-2xl');
code = code.replace(/text-4xl/g, 'text-xl');
code = code.replace(/text-3xl/g, 'text-lg');
code = code.replace(/text-2xl/g, 'text-base');
code = code.replace(/text-xl/g, 'text-sm');
code = code.replace(/text-lg/g, 'text-sm');

// Paddings
code = code.replace(/p-12/g, 'p-6');
code = code.replace(/p-10/g, 'p-6');
code = code.replace(/p-8/g, 'p-5');
code = code.replace(/px-8 py-4/g, 'px-4 py-2 text-sm');
code = code.replace(/px-10 py-5/g, 'px-4 py-2 text-sm');
code = code.replace(/px-6 py-3/g, 'px-3 py-1.5 text-xs');
code = code.replace(/py-20/g, 'py-10');

// Border Radius
code = code.replace(/rounded-\[48px\]/g, 'rounded-2xl');
code = code.replace(/rounded-\[40px\]/g, 'rounded-2xl');
code = code.replace(/rounded-\[32px\]/g, 'rounded-xl');
code = code.replace(/rounded-\[28px\]/g, 'rounded-xl');
code = code.replace(/rounded-3xl/g, 'rounded-xl');
code = code.replace(/rounded-2xl/g, 'rounded-lg');

// Icon sizing adjustment
code = code.replace(/w-24 h-24/g, 'w-12 h-12');
code = code.replace(/w-20 h-20/g, 'w-12 h-12');
code = code.replace(/w-16 h-16/g, 'w-12 h-12');
code = code.replace(/w-14 h-14/g, 'w-10 h-10');
code = code.replace(/w-12 h-12/g, 'w-8 h-8');
code = code.replace(/w-10 h-10/g, 'w-6 h-6');
code = code.replace(/h-10 w-10/g, 'h-6 w-6');
code = code.replace(/h-8 w-8/g, 'h-5 w-5');
code = code.replace(/h-7 w-7/g, 'h-5 w-5');
code = code.replace(/h-6 w-6/g, 'h-4 w-4');
code = code.replace(/w-8 h-8/g, 'w-5 h-5');
code = code.replace(/w-6 h-6/g, 'w-4 h-4');

// Small spacing adjustments
code = code.replace(/gap-8/g, 'gap-4');
code = code.replace(/gap-6/g, 'gap-3');
code = code.replace(/mb-16/g, 'mb-8');
code = code.replace(/mb-12/g, 'mb-6');
code = code.replace(/mb-10/g, 'mb-6');
code = code.replace(/mt-10/g, 'mt-6');

// Specific targeted replacements
code = code.replace(/Your Creative <span className="text-foreground">Universe<\/span>, <br \/>/g, 'Your Creative Workspace, <br />');
code = code.replace(/font-black/g, 'font-bold');
code = code.replace(/explore workspace/ig, 'Explore Workspace');


try {
  fs.writeFileSync(file, code, 'utf8');
  console.log("Refactoring complete");
} catch(e) {
  console.error("Error", e);
}
