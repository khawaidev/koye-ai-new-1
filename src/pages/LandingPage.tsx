import { motion } from 'framer-motion';
import {
    ArrowRight,
    Box,
    Check,
    ChevronLeft,
    ChevronRight,
    Cloud,
    Code,
    Copy,
    Download,
    Globe,
    Heart,
    Image,
    MessageSquare,
    Music,
    Rocket,
    Sparkles,
    Terminal,
    Users,
    Video,
    Wand2,
    Zap
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../components/theme-provider';
import appIcon from '../assets/icon2.png';

import { ThemeToggle } from '../components/ui/theme-toggle';

// Smooth scroll function
const smoothScrollTo = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
};

// Copy command component with copy-to-clipboard functionality
const CopyCommand = ({ command }: { command: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-foreground text-background p-4 rounded font-mono text-sm"
        >
            <div className="flex items-center gap-2 mb-2 text-green-400">
                <span>#</span>
                <span className="text-background/70">Install KOYE CLI</span>
            </div>
            <div className="flex items-center justify-between gap-4">
                <code className="text-background flex-1 overflow-x-auto">{command}</code>
                <button
                    onClick={handleCopy}
                    className="p-2 hover:bg-background/10 rounded transition-colors shrink-0"
                    title="Copy to clipboard"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-background" />
                    )}
                </button>
            </div>
        </motion.div>
    );
};

const Navbar = () => {
    const { theme } = useTheme();
    const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
        e.preventDefault();
        smoothScrollTo(sectionId);
    }, []);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
            <style>{`
                .landing-auth-btn {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px 16px;
                    border: 2px solid hsl(var(--foreground));
                    text-transform: uppercase;
                    color: hsl(var(--foreground));
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 14px;
                    background: transparent;
                    transition: color 0.3s;
                }
                .landing-auth-btn::before {
                    content: '';
                    position: absolute;
                    top: 6px;
                    left: -2px;
                    width: calc(100% + 4px);
                    height: calc(100% - 12px);
                    background-color: hsl(var(--background));
                    transition: 0.3s ease-in-out;
                    transform: scaleY(1);
                    z-index: 1;
                }
                .landing-auth-btn:hover::before {
                    transform: scaleY(0);
                }
                .landing-auth-btn::after {
                    content: '';
                    position: absolute;
                    left: 6px;
                    top: -2px;
                    height: calc(100% + 4px);
                    width: calc(100% - 12px);
                    background-color: hsl(var(--background));
                    transition: 0.3s ease-in-out;
                    transform: scaleX(1);
                    transition-delay: 0.5s;
                    z-index: 1;
                }
                .landing-auth-btn:hover::after {
                    transform: scaleX(0);
                }
                .landing-auth-btn span,
                .landing-auth-btn svg {
                    position: relative;
                    z-index: 3;
                }
            `}</style>
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xl font-bold tracking-tighter text-foreground">
                    <img 
                        src={appIcon} 
                        alt="KOYE" 
                        className={`w-8 h-8 rounded-full object-cover ${theme === 'dark' ? 'invert' : ''}`}
                    />
                    <span>KOYE_AI</span>
                </div>
                <div className="hidden md:flex items-center gap-8 font-mono text-sm text-foreground">
                    <a
                        href="#features"
                        onClick={(e) => handleNavClick(e, 'features')}
                        className="hover:text-muted-foreground transition-colors"
                    >
                        ./features
                    </a>
                    <a
                        href="#cli"
                        onClick={(e) => handleNavClick(e, 'cli')}
                        className="hover:text-muted-foreground transition-colors"
                    >
                        ./cli
                    </a>
                    <a
                        href="#pricing"
                        onClick={(e) => handleNavClick(e, 'pricing')}
                        className="hover:text-muted-foreground transition-colors"
                    >
                        ./pricing
                    </a>
                    <a
                        href="#about"
                        onClick={(e) => handleNavClick(e, 'about')}
                        className="hover:text-muted-foreground transition-colors"
                    >
                        ./about
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link to="/login" className="landing-auth-btn font-mono">
                        <span>log_in</span>
                    </Link>
                    <Link to="/signup" className="landing-auth-btn font-mono gap-2">
                        <span>sign_up for free</span>

                    </Link>
                </div>
            </div>
        </nav>
    );
};

const TerminalCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((current) => (current + 1) % 3);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full flex-col flex gap-4">
            <div className="relative w-full overflow-hidden rounded-xl">
                <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ width: "300%", transform: `translateX(-${activeIndex * (100 / 3)}%)` }}
                >
                    {/* Slide 1: koye_terminal */}
                    <div className="w-1/3 shrink-0 px-2 flex justify-center">
                        <div className="w-full bg-foreground rounded-lg overflow-hidden shadow-2xl border border-border">
                            {/* Terminal Header */}
                            <div className="flex items-center gap-2 px-4 py-3 bg-foreground border-b border-muted-foreground/30">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-background/70 text-sm font-mono ml-2">koye_terminal</span>
                            </div>
                            {/* Terminal Content */}
                            <div className="p-6 font-mono text-sm text-background/90 space-y-2 h-[350px] overflow-y-auto text-left">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-400">$</span>
                                    <span>curl -fsSL https://start.koye.ai/install.sh | bash</span>
                                </div>
                                <div className="text-background/60 pl-4">✓ KOYE CLI installed successfully</div>
                                <div className="flex items-center gap-2 mt-4">
                                    <span className="text-green-400">$</span>
                                    <span>koye init</span>
                                </div>
                                <div className="text-background/60 pl-4">✓ Initialized in ./my-game-project</div>
                                <div className="flex items-center gap-2 mt-4">
                                    <span className="text-green-400">$</span>
                                    <span>koye chat</span>
                                </div>
                                <div className="text-background/60 pl-4">🎮 Starting AI game dev assistant...</div>
                                <div className="mt-4 p-3 border border-muted-foreground/30 rounded flex-col">
                                    <div className="text-green-400 mb-2">[KOYE AI]</div>
                                    <div className="text-background/80">
                                        What would you like to create today?<br />
                                        <span className="text-muted-foreground/80">• Generate 2D sprites</span><br />
                                        <span className="text-muted-foreground/80">• Create 3D models</span><br />
                                        <span className="text-muted-foreground/80">• Generate audio/video</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4">
                                    <span className="text-green-400">$</span>
                                    <span className="animate-pulse">_</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 2: CLI Commands Grid */}
                    <div className="w-1/3 shrink-0 px-2 flex justify-center items-center">
                        <div className="w-full grid grid-cols-2 gap-4 h-[350px] content-center text-left">
                            <div className="p-4 bg-background border border-border rounded-lg shadow-xl shadow-foreground/5 h-28 flex flex-col justify-center">
                                <code className="text-sm font-mono text-foreground">koye init</code>
                                <p className="text-xs text-muted-foreground mt-1">Initialize in project</p>
                            </div>
                            <div className="p-4 bg-background border border-border rounded-lg shadow-xl shadow-foreground/5 h-28 flex flex-col justify-center">
                                <code className="text-sm font-mono text-foreground">koye login</code>
                                <p className="text-xs text-muted-foreground mt-1">Authenticate account</p>
                            </div>
                            <div className="p-4 bg-background border border-border rounded-lg shadow-xl shadow-foreground/5 h-28 flex flex-col justify-center">
                                <code className="text-sm font-mono text-foreground">koye chat</code>
                                <p className="text-xs text-muted-foreground mt-1">Start AI assistant</p>
                            </div>
                            <div className="p-4 bg-background border border-border rounded-lg shadow-xl shadow-foreground/5 h-28 flex flex-col justify-center">
                                <code className="text-sm font-mono text-foreground">koye profile</code>
                                <p className="text-xs text-muted-foreground mt-1">View account info</p>
                            </div>
                        </div>
                    </div>

                    {/* Slide 3: Asset Output Structure */}
                    <div className="w-1/3 shrink-0 px-2 flex justify-center">
                        <div className="w-full p-6 bg-background border border-border rounded-lg shadow-xl shadow-foreground/5 h-[350px] overflow-y-auto text-left">
                            <h4 className="font-mono font-bold text-foreground mb-4">$ tree koye-assets/</h4>
                            <pre className="text-sm text-muted-foreground font-mono">
                                {`koye-assets/
├── images/
│   ├── character_front.png
│   └── character_sprites.png
├── 3dmodels/
│   ├── sword.glb
│   └── helmet.obj
├── videos/
│   └── trailer.mp4
└── audio/
    ├── jump_sfx.mp3
    └── bg_music.wav`}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-2">
                {[0, 1, 2].map(idx => (
                    <button
                        key={idx}
                        onClick={() => setActiveIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${activeIndex === idx ? "bg-foreground w-6" : "bg-foreground/20 hover:bg-foreground/40"}`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

const Hero = () => {
    return (
        <section className="pt-32 pb-20 px-6 min-h-screen flex items-center border-b border-border relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--muted-foreground)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted-foreground)/0.1)_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            <div className="container mx-auto relative z-10">
                <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/20 text-sm font-mono mb-8 text-foreground"
                    >
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Web App + CLI — One Platform</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 font-mono text-foreground"
                    >
                        AI GAME ENGINE FOR<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground">
                            THE NEXT GENERATION.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 font-mono leading-relaxed"
                    >
                        &gt; Turn ideas into playable games — instantly.<br />
                        &gt; Generate assets, code, launch live demo in your browser.<br />
                        &gt; Iterate with AI — modify, expand, build in real-time.<br />
                        &gt; Export to your favorite engines or use it from terminal.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center w-full"
                    >
                        <Link
                            to="/signup"
                            className="px-8 py-4 bg-foreground text-background font-mono font-bold rounded hover:bg-muted-foreground transition-all flex items-center justify-center gap-2 group w-full sm:w-auto"
                        >
                            <Cloud className="w-5 h-5" />
                            <span>OPEN_WEB_APP</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="#cli"
                            onClick={(e) => { e.preventDefault(); smoothScrollTo('cli'); }}
                            className="px-8 py-4 border border-border text-foreground font-mono rounded hover:bg-muted/20 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                            <Terminal className="w-5 h-5" />
                            <span>INSTALL_CLI</span>
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="p-6 border border-border bg-muted/5 rounded-lg hover:border-foreground/30 transition-colors group">
        <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-foreground" />
        </div>
        <h3 className="text-xl font-bold font-mono mb-2 text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
    </div>
);

const Features = () => (
    <section id="features" className="py-24 border-b border-border bg-background scroll-mt-16">
        <div className="container mx-auto px-6">
            <div className="mb-16">
                <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6 text-foreground">AI_CREATION_SUITE</h2>
                <p className="text-muted-foreground max-w-2xl">
                    Everything you need to create stunning game assets. From concept to production-ready assets,
                    our AI-powered tools handle the heavy lifting — in the browser or your terminal.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <FeatureCard
                    icon={MessageSquare}
                    title="AI Chat Interface"
                    description="Chat naturally with AI to describe your game concepts. Get intelligent suggestions, generate code, and iterate on ideas in real-time."
                />
                <FeatureCard
                    icon={Image}
                    title="Image Generation"
                    description="Generate 2D sprites, textures, concept art, and character designs. Multiple view generation for consistent 3D-ready assets."
                />
                <FeatureCard
                    icon={Box}
                    title="3D Model Creation"
                    description="Transform images into production-ready 3D models. Support for GLB, OBJ, FBX, and STL formats with automatic rigging."
                />
                <FeatureCard
                    icon={Video}
                    title="Video Generation"
                    description="Create cinematic trailers, cutscenes, and promotional videos with AI. Powered by Veo 3 for high-quality output."
                />
                <FeatureCard
                    icon={Music}
                    title="Audio Generation"
                    description="Generate sound effects, ambient tracks, and background music. Perfect for game audio without expensive licensing."
                />
                <FeatureCard
                    icon={Wand2}
                    title="Sprite Animations"
                    description="Create animated sprite sheets with multiple frames. Ideal for 2D games, character animations, and UI elements."
                />
            </div>
        </div>
    </section>
);

const CLI = () => (
    <section id="cli" className="py-24 border-b border-border bg-muted/5 scroll-mt-16">
        <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-sm font-mono mb-6 text-foreground">
                            <Terminal className="w-4 h-4" />
                            <span>Command Line Interface</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6 text-foreground">KOYE_CLI</h2>
                        <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                            Build game assets directly from your terminal. The KOYE CLI integrates seamlessly
                            with your development workflow, letting you generate assets without leaving your IDE.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        viewport={{ once: true }}
                        className="space-y-4 mb-8"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-foreground text-background rounded flex items-center justify-center shrink-0">
                                <Download className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-mono font-bold text-foreground">Easy Installation</h4>
                                <p className="text-sm text-muted-foreground">One-line install script. Works on macOS, Linux, and Windows (WSL).</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-foreground text-background rounded flex items-center justify-center shrink-0">
                                <Code className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-mono font-bold text-foreground">Project Integration</h4>
                                <p className="text-sm text-muted-foreground">Initialize in any folder. Assets auto-save to organized directories.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-foreground text-background rounded flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-mono font-bold text-foreground">Same Credits System</h4>
                                <p className="text-sm text-muted-foreground">Use your account credits across web app and CLI. Synced automatically.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-foreground text-background rounded flex items-center justify-center shrink-0">
                                <Globe className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-mono font-bold text-foreground">Unity & Unreal Ready</h4>
                                <p className="text-sm text-muted-foreground">Export formats optimized for game engines. Direct import support.</p>
                            </div>
                        </div>
                    </motion.div>

                    <CopyCommand command="curl -fsSL https://start.koye.ai/install.sh | bash" />
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    viewport={{ once: true }}
                    className="w-full flex items-center justify-center pt-8 lg:pt-0"
                >
                    <TerminalCarousel />
                </motion.div>
            </div>
        </div>
    </section>
);

const PricingDetailsCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const nextSlide = useCallback(() => setActiveIndex((current) => (current + 1) % 2), []);
    const prevSlide = useCallback(() => setActiveIndex((current) => (current - 1 + 2) % 2), []);

    useEffect(() => {
        const interval = setInterval(() => {
            nextSlide();
        }, 3000);
        return () => clearInterval(interval);
    }, [nextSlide]);

    return (
        <div className="relative max-w-5xl mx-auto px-4 group mt-8">
            <div className="overflow-hidden rounded-xl">
                <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ width: "200%", transform: `translateX(-${activeIndex * 50}%)` }}
                >
                    {/* Slide 1: Credit Top-Ups */}
                    <div className="w-1/2 shrink-0 px-4 pb-4">
                        <div className="text-center mb-10">
                            <h3 className="text-2xl md:text-3xl font-mono font-bold text-foreground mb-3 flex items-center justify-center gap-3">
                                <div className="p-2 bg-foreground/10 rounded-lg">
                                    <Zap className="w-6 h-6 text-foreground" />
                                </div>
                                CREDIT_TOPUPS
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                                Need more generating power? Instantly top up your account with more credits. Bonus credits scale with larger packs!
                            </p>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-6 relative">
                            {/* Decorative background element */}
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-foreground/5 to-background rounded-3xl blur-3xl -z-10" />

                            <div className="p-6 bg-background/50 backdrop-blur-sm border border-border rounded-2xl text-center hover:border-foreground/30 hover:shadow-xl hover:shadow-foreground/5 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="text-4xl font-mono font-bold text-foreground mb-1 tracking-tighter">$5<span className="text-2xl text-muted-foreground/60">.00</span></div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-6">₹375</div>
                                </div>
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/50 transition-colors">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Sparkles className="w-5 h-5 text-muted-foreground transition-colors" />
                                        <span className="text-3xl font-bold text-foreground font-mono">500</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono tracking-widest uppercase">credits</div>
                                </div>
                            </div>

                            <div className="p-6 bg-foreground backdrop-blur-sm border-2 border-foreground rounded-2xl text-center shadow-2xl shadow-foreground/20 transition-all flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute -top-4 -right-4 p-8 opacity-10 transition-all duration-500">
                                    <Zap className="w-32 h-32 text-background" />
                                </div>
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-background text-foreground text-xs font-mono font-bold rounded-full shadow-lg">
                                    MOST_POPULAR
                                </div>
                                <div className="relative z-10 pt-4">
                                    <div className="text-4xl font-mono font-bold text-background mb-1 tracking-tighter">$10<span className="text-2xl text-background/60">.00</span></div>
                                    <div className="text-xs text-background/60 uppercase tracking-wider font-mono mb-6">₹750</div>
                                </div>
                                <div className="p-5 rounded-xl bg-background/10 border border-background/20 relative z-10 backdrop-blur-md">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Sparkles className="w-5 h-5 text-background" />
                                        <span className="text-3xl font-bold text-background font-mono">1,200</span>
                                    </div>
                                    <div className="text-xs text-background/80 font-mono tracking-widest uppercase mb-3">credits</div>
                                    <div className="inline-flex items-center px-3 py-1 bg-background/20 text-background text-xs font-bold rounded-full border border-background/30">
                                        +20% BONUS
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-background/50 backdrop-blur-sm border border-border rounded-2xl text-center hover:border-foreground/30 hover:shadow-xl hover:shadow-foreground/5 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="text-4xl font-mono font-bold text-foreground mb-1 tracking-tighter">$20<span className="text-2xl text-muted-foreground/60">.00</span></div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-6">₹1,500</div>
                                </div>
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/50 transition-colors">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Sparkles className="w-5 h-5 text-muted-foreground transition-transform" />
                                        <span className="text-3xl font-bold text-foreground font-mono">3,000</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono tracking-widest uppercase mb-3">credits</div>
                                    <div className="inline-flex items-center px-3 py-1 bg-foreground/10 text-foreground text-xs font-bold rounded-full border border-foreground/20">
                                        +50% BONUS
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 2: Credit Costs */}
                    <div className="w-1/2 shrink-0 px-4 pb-4">
                        <div className="text-center mb-10">
                            <h3 className="text-2xl md:text-3xl font-mono font-bold text-foreground mb-3 flex items-center justify-center gap-3">
                                CREDIT_COSTS
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                                Transparent pricing for every action. Know exactly what you are paying for ahead of time.
                            </p>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">AI Chat</p>
                                <p className="text-xs text-muted-foreground">100 credits / 1M tokens</p>
                            </div>
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <Image className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">Image Gen</p>
                                <p className="text-xs text-muted-foreground">5-15 credits / image</p>
                            </div>
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <Box className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">3D Model</p>
                                <p className="text-xs text-muted-foreground">20-70 credits / model</p>
                            </div>
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <Video className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">Video Gen</p>
                                <p className="text-xs text-muted-foreground">10-25 credits / second</p>
                            </div>
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <Music className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">Audio Gen</p>
                                <p className="text-xs text-muted-foreground">5 credits / second</p>
                            </div>
                            <div className="p-4 bg-muted/10 border border-border rounded-lg text-center">
                                <Sparkles className="w-6 h-6 mx-auto mb-2 text-foreground" />
                                <p className="font-mono text-sm text-foreground font-bold">Game Gen</p>
                                <p className="text-xs text-muted-foreground">100-500 credits / game</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Arrows */}
            <button 
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-background border border-border rounded-full p-2 text-foreground opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-muted md:-translate-x-full"
                aria-label="Previous pane"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-background border border-border rounded-full p-2 text-foreground opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-muted md:translate-x-full"
                aria-label="Next pane"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
                {[0, 1].map(idx => (
                    <button
                        key={idx}
                        onClick={() => setActiveIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${activeIndex === idx ? "bg-foreground w-6" : "bg-foreground/20 hover:bg-foreground/40"}`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
            <div className="h-4"></div>
        </div>
    );
};

const Pricing = () => {
    const navigate = useNavigate();

    return (
        <section id="pricing" className="py-24 border-b border-border bg-background scroll-mt-16">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6 text-foreground">SUBSCRIPTION_PLANS</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Choose the plan that fits your needs. All plans work across web app and CLI.
                        Need more credits? Buy top-ups anytime!
                    </p>
                </div>

                {/* Pricing Cards - Matching Pricing.tsx */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
                    {/* INDIE Plan */}
                    <div className="relative p-8 border border-border bg-background rounded-xl flex flex-col">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-muted text-foreground text-xs font-mono font-bold rounded-full border border-border">
                            STUDENTS
                        </div>
                        <div className="mb-8">
                            <h3 className="text-xl font-mono font-bold mb-2 text-foreground">INDIE</h3>
                            <div className="flex items-baseline gap-1 text-foreground">
                                <span className="text-4xl font-bold">$4.99</span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">₹399/mo</div>
                            <div className="mt-4 p-3 bg-muted/10 rounded border border-border">
                                <p className="text-sm font-mono text-muted-foreground">500 credits/month</p>
                            </div>
                        </div>
                        <ul className="flex-1 space-y-4 mb-8">
                            {["No commercial license", "Community support", "Standard priority", "5GB storage"].map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <Check className="w-4 h-4 mt-0.5 text-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="w-full py-3 font-mono text-sm font-bold rounded transition-colors border border-border text-foreground hover:bg-muted"
                        >
                            SELECT_PLAN
                        </button>
                    </div>

                    {/* PRO Plan - Recommended */}
                    <div className="relative p-8 border border-foreground bg-muted/10 rounded-xl flex flex-col">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-foreground text-background text-xs font-mono font-bold rounded-full">
                            POPULAR
                        </div>
                        <div className="mb-8">
                            <h3 className="text-xl font-mono font-bold mb-2 text-foreground">PRO</h3>
                            <div className="flex items-baseline gap-1 text-foreground">
                                <span className="text-4xl font-bold">$19.99</span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">₹1,299/mo</div>
                            <div className="mt-4 p-3 bg-muted/10 rounded border border-border">
                                <p className="text-sm font-mono text-muted-foreground">3,000 credits/month</p>
                            </div>
                        </div>
                        <ul className="flex-1 space-y-4 mb-8">
                            {["Commercial license", "Unity/Unreal helpers", "Full export options", "20GB storage", "Standard priority"].map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <Check className="w-4 h-4 mt-0.5 text-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="w-full py-3 font-mono text-sm font-bold rounded transition-colors bg-foreground text-background hover:bg-muted-foreground"
                        >
                            SELECT_PLAN
                        </button>
                    </div>

                    {/* PRO_PLUS Plan */}
                    <div className="relative p-8 border border-border bg-background rounded-xl flex flex-col">
                        <div className="mb-8">
                            <h3 className="text-xl font-mono font-bold mb-2 text-foreground">PRO_PLUS</h3>
                            <div className="flex items-baseline gap-1 text-foreground">
                                <span className="text-4xl font-bold">$34.99</span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">₹2,499/mo</div>
                            <div className="mt-4 p-3 bg-muted/10 rounded border border-border">
                                <p className="text-sm font-mono text-muted-foreground">8,000 credits/month</p>
                            </div>
                        </div>
                        <ul className="flex-1 space-y-4 mb-8">
                            {["High priority queue", "100GB storage", "Early access features", "AI code generation", "Custom export presets"].map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <Check className="w-4 h-4 mt-0.5 text-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="w-full py-3 font-mono text-sm font-bold rounded transition-colors border border-border text-foreground hover:bg-muted"
                        >
                            SELECT_PLAN
                        </button>
                    </div>

                    {/* STUDIO Plan */}
                    <div className="relative p-8 border border-border bg-background rounded-xl flex flex-col">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-muted text-foreground text-xs font-mono font-bold rounded-full border border-border">
                            ENTERPRISE
                        </div>
                        <div className="mb-8">
                            <h3 className="text-xl font-mono font-bold mb-2 text-foreground">STUDIO</h3>
                            <div className="flex items-baseline gap-1 text-foreground">
                                <span className="text-4xl font-bold">$999+</span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">₹49,999+/mo</div>
                            <div className="mt-4 p-3 bg-muted/10 rounded border border-border">
                                <p className="text-sm font-mono text-muted-foreground">Unlimited credits</p>
                            </div>
                        </div>
                        <ul className="flex-1 space-y-4 mb-8">
                            {["Unlimited team seats", "Private inference", "Guaranteed SLA", "Dedicated support", "Custom model fine-tuning"].map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                    <Check className="w-4 h-4 mt-0.5 text-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="w-full py-3 font-mono text-sm font-bold rounded transition-colors border border-border text-foreground hover:bg-muted"
                        >
                            CONTACT_SALES
                        </button>
                    </div>
                </div>

                {/* View Full Pricing Link */}
                <div className="text-center mb-16 mt-6">
                    <Link to="/pricing" className="text-sm font-mono text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                        [view_full_pricing] →
                    </Link>
                </div>

                <PricingDetailsCarousel />
            </div>
        </section>
    );
};

const About = () => (
    <section id="about" className="py-24 border-b border-border bg-background scroll-mt-16">
        <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6 text-foreground">ABOUT_KOYE</h2>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        We're building the future of game development, one AI-generated asset at a time.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        viewport={{ once: true }}
                        className="text-center p-6"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 bg-muted/20 rounded-full flex items-center justify-center">
                            <Rocket className="w-8 h-8 text-foreground" />
                        </div>
                        <h3 className="text-xl font-bold font-mono mb-2 text-foreground">OUR_MISSION</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Democratize game development by making professional-quality asset creation
                            accessible to indie developers, hobbyists, and studios of all sizes.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        viewport={{ once: true }}
                        className="text-center p-6"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 bg-muted/20 rounded-full flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-foreground" />
                        </div>
                        <h3 className="text-xl font-bold font-mono mb-2 text-foreground">THE_TECHNOLOGY</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Powered by cutting-edge AI models including Gemini, Pixazo, Veo 3, and Hitem3D
                            for game-specific asset generation with consistent style.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        viewport={{ once: true }}
                        className="text-center p-6"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 bg-muted/20 rounded-full flex items-center justify-center">
                            <Users className="w-8 h-8 text-foreground" />
                        </div>
                        <h3 className="text-xl font-bold font-mono mb-2 text-foreground">TWO_PLATFORMS</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Use the web app for visual workflows or the CLI for terminal-based development.
                            Same account, same credits, seamless experience.
                        </p>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="bg-muted/10 border border-border rounded-xl p-8 text-center"
                >
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Heart className="w-6 h-6 text-red-500" />
                        <span className="text-xl font-bold font-mono text-foreground">BUILT_FOR_CREATORS</span>
                    </div>
                    <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        KOYE AI was born from the frustration of spending countless hours on asset creation
                        instead of actual game development. We believe that anyone with a vision should be able
                        to create beautiful games, regardless of their artistic or technical background.
                        Our AI handles the heavy lifting so you can focus on what matters most —
                        <span className="text-foreground font-semibold"> making games that players will love.</span>
                    </p>
                </motion.div>
            </div>
        </div>
    </section>
);

const Footer = () => {
    const { theme } = useTheme();
    const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
        e.preventDefault();
        smoothScrollTo(sectionId);
    }, []);

    return (
        <footer className="py-12 border-t border-border bg-background">
            <div className="container mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-12 mb-12">
                    <div>
                        <div className="flex items-center gap-2 font-mono text-xl font-bold mb-6 text-foreground">
                            <img 
                                src={appIcon} 
                                alt="KOYE" 
                                className={`w-8 h-8 rounded-full object-cover ${theme === 'dark' ? 'invert' : ''}`}
                            />
                            <span>KOYE_AI</span>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            AI-powered game asset creation platform. Use in the browser or directly from your terminal.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-mono font-bold mb-6 text-foreground">PLATFORMS</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link to="/signup" className="hover:text-foreground transition-colors">Web App</Link></li>
                            <li><a href="#cli" onClick={(e) => handleNavClick(e, 'cli')} className="hover:text-foreground transition-colors">CLI Tool</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">API Access</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-mono font-bold mb-6 text-foreground">RESOURCES</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><a href="#features" onClick={(e) => handleNavClick(e, 'features')} className="hover:text-foreground transition-colors">Features</a></li>
                            <li><a href="#pricing" onClick={(e) => handleNavClick(e, 'pricing')} className="hover:text-foreground transition-colors">Pricing</a></li>
                            <li><a href="#about" onClick={(e) => handleNavClick(e, 'about')} className="hover:text-foreground transition-colors">About</a></li>
                            <li><Link to="/animations" className="hover:text-foreground transition-colors">Animations Library</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-mono font-bold mb-6 text-foreground">LEGAL</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-muted-foreground text-sm font-mono">
                        © 2024 KOYE AI. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
                        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
                        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Discord</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export const LandingPage = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const isPreview = params.get("preview") === "true";

        if (!loading && user && !isPreview) {
            navigate("/app");
        }
    }, [user, loading, navigate]);

    // Handle hash navigation on page load
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            setTimeout(() => {
                smoothScrollTo(hash);
            }, 100);
        }
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background scroll-smooth">
            <Navbar />
            <Hero />
            <Features />
            <CLI />
            <Pricing />
            <About />
            <Footer />
        </div>
    );
};

export default LandingPage;
