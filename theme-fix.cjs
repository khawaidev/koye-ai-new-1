const fs = require('fs');
const file = 'src/pages/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// Sidebar smooth animation
code = code.replace(/duration-500/g, 'duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]');

// Remove Sidebar Header
const sidebarHeaderRegex = /\{\/\* Sidebar Header \*\/\}\s*<div.*?<\/button>\s*<\/div>/s;
code = code.replace(sidebarHeaderRegex, '');
// Add pt-6 to the sidebar scroll container
code = code.replace(/className="flex-1 overflow-y-auto px-4 py-2 bg-transparent custom-scrollbar"/g, 'className="flex-1 overflow-y-auto px-4 pt-6 pb-2 bg-transparent custom-scrollbar"');

// Fix theme contrast (White backgrounds, black text, light theme borders)
// Replace hardcoded "bg-white" and "text-black" with theme variables
code = code.replace(/bg-white text-black hover:bg-white\/90 text-foreground/g, 'bg-foreground text-background hover:bg-foreground/90');
code = code.replace(/bg-white text-black hover:bg-white\/90/g, 'bg-foreground text-background hover:bg-foreground/90');
code = code.replace(/bg-white text-black/g, 'bg-foreground text-background');
code = code.replace(/text-black/g, 'text-background');

// Replace glassmorphism whites with theme-aware foreground opacity 
code = code.replace(/bg-white\/5/g, 'bg-foreground/5');
code = code.replace(/bg-white\/10/g, 'bg-foreground/10');
code = code.replace(/bg-white\/20/g, 'bg-foreground/20');

code = code.replace(/border-white\/5/g, 'border-foreground/5');
code = code.replace(/border-white\/10/g, 'border-foreground/10');
code = code.replace(/border-white\/20/g, 'border-foreground/20');
code = code.replace(/border-white\/30/g, 'border-foreground/30');

// Fix Claim Pro Trial Button size
code = code.replace(/w-full py-5 bg-white\/10 text-foreground/g, 'w-fit mx-auto px-8 py-3 bg-foreground/10 text-foreground');

// Fix Assets Tab Default State
// It usually says something like: const [assetsTab, setAssetsTab] = useState<"images"|...>("something")
// We will look for "assetsTab" initialization
code = code.replace(/const \[assetsTab, setAssetsTab\] = useState.*?\(.*?\)/, 'const [assetsTab, setAssetsTab] = useState<"images" | "models" | "videos" | "audio">("images")');

// Fix Delete Project Button visibility
// Add opacity-0 group-hover:opacity-100 to the container of the delete project button
code = code.replace(/<div className="absolute top-0 right-0 p-4 translate-x-12 group-hover:translate-x-0 transition-transform">/g, '<div className="absolute top-0 right-0 p-4 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">');

// Projects Tab Cards Redesign
// Currently: p-8 rounded-[40px] (which we replaced to rounded-2xl), w-16 h-16 (now w-12 h-12)
// I'll leave the regex replacements for projects/3d models for the string replacer below or I can use AST/regular expressions carefully.

fs.writeFileSync(file, code, 'utf8');
console.log('Script applied.');
