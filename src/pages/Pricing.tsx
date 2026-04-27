import { Activity, Box, Check, Gamepad2, Loader2, MessageSquare, Palette, Video } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import appIcon from "../assets/icon2.png"
import { useTheme } from "../components/theme-provider"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { ThemeToggle } from "../components/ui/theme-toggle"
import { useAuth } from "../hooks/useAuth"
import { usePricing } from "../hooks/usePricing"
import { subscribeToPlan } from "../services/pricingService"
import { openRazorpayCheckout } from "../services/razorpay"

interface PricingPlan {
  name: string
  price: string
  priceUsd: string
  description: string
  features: string[]
  highlight?: boolean
}

const plans: PricingPlan[] = [
  {
    name: "INDIE",
    price: "₹399/month",
    priceUsd: "$4.99/month",
    description: "Best for students",
    features: [
      "500 credits/month",
      "No commercial license",
      "Community support",
      "Standard priority",
      "5GB storage",
    ],
  },
  {
    name: "PRO",
    price: "₹1,299/month",
    priceUsd: "$19.99/month",
    description: "Great for indie developers",
    features: [
      "3,000 credits/month",
      "Standard priority",
      "20GB storage",
      "Commercial license",
      "Unity/Unreal helpers",
      "Full export options",
    ],
    highlight: true,
  },
  {
    name: "PRO_PLUS",
    price: "₹2,499/month",
    priceUsd: "$34.99/month",
    description: "For creators who need more",
    features: [
      "8,000 credits/month",
      "High priority queue",
      "100GB storage",
      "Commercial license",
      "Early access features",
      "AI code generation",
      "Custom export presets",
    ],
  },
  {
    name: "STUDIO",
    price: "₹49,999+ /month",
    priceUsd: "$999+ /month",
    description: "For studios & production houses",
    features: [
      "Unlimited credits",
      "Unlimited team seats",
      "Unlimited storage",
      "Private inference endpoint",
      "Guaranteed SLA",
      "Dedicated support engineer",
      "On-premise deployment option",
      "Custom model fine-tuning",
    ],
  },
]

export function Pricing() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { isAuthenticated, user } = useAuth()
  const { plans: dbPlans, subscription, refresh, loading: pricingLoading } = usePricing()
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Map plan names to database plan names
  const planNameMap: Record<string, string> = {
    INDIE: "INDIE",
    PRO: "PRO",
    PRO_PLUS: "PRO_PLUS",
    STUDIO: "STUDIO",
  }

  const handleGetStarted = async (planName: string) => {
    if (!isAuthenticated) {
      navigate("/signup")
      return
    }

    if (!user) {
      setError("Please log in to subscribe")
      return
    }

    // For STUDIO plan, show contact message
    if (planName === "STUDIO") {
      alert("Please contact sales for STUDIO plan subscription")
      return
    }

    // Find the plan in database
    const dbPlanName = planNameMap[planName]
    const dbPlan = dbPlans.find((p) => p.name === dbPlanName)

    if (!dbPlan) {
      setError(`Plan ${planName} not found. Please try again later.`)
      return
    }

    // Check if user already has this plan
    if (subscription && subscription.planName === dbPlanName && subscription.status === "active") {
      alert(`You are already subscribed to ${dbPlan.displayName}`)
      return
    }

    setProcessingPlan(planName)
    setError(null)

    try {
      // Calculate amount in paise (smallest currency unit for INR)
      const amountInPaise = dbPlan.priceInr * 100

      // Convert icon URL to absolute URL for Razorpay
      const iconUrl = appIcon.startsWith('http')
        ? appIcon
        : new URL(appIcon, window.location.origin).href

      // Open Razorpay checkout
      await openRazorpayCheckout(
        {
          amount: amountInPaise,
          currency: "INR",
          name: "KOYE AI",
          description: `Subscription to ${dbPlan.displayName} plan`,
          image: iconUrl, // App icon as merchant logo
          prefill: {
            name: user.email?.split("@")[0] || "User",
            email: user.email || undefined,
          },
          notes: {
            plan_id: dbPlan.id,
            plan_name: dbPlan.name,
            user_id: user.id,
          },
          theme: {
            color: "#000000",
          },
        },
        async (response) => {
          // Payment successful - update subscription
          try {
            console.log("Payment successful:", response)

            // Subscribe user to plan
            await subscribeToPlan(user.id, dbPlan.id)

            // Refresh pricing data
            await refresh()

            setProcessingPlan(null)
            alert(`Successfully subscribed to ${dbPlan.displayName}!`)

            // Navigate to dashboard
            navigate("/dashboard?tab=usage")
          } catch (error) {
            console.error("Error updating subscription:", error)
            setError("Payment successful but failed to update subscription. Please contact support.")
            setProcessingPlan(null)
          }
        },
        (error) => {
          console.error("Payment error:", error)
          setError(error.message || "Payment failed. Please try again.")
          setProcessingPlan(null)
        }
      )
    } catch (error) {
      console.error("Error initiating payment:", error)
      setError(error instanceof Error ? error.message : "Failed to initiate payment. Please try again.")
      setProcessingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      {/* Top Header with Logo and Dashboard Button */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background text-foreground">
        <div className="flex items-center gap-3 relative">
          <img
            src={appIcon}
            alt="KOYE AI"
            className={cn("h-12 w-12 object-contain", theme === "dark" && "invert")}
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono">
              KOYE<span className="font-extrabold">_</span>AI
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              AI game builder
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            onClick={() => navigate(-1)}
            className="bg-background text-foreground border-2 border-foreground shadow-[4px_4px_0px_0px_currentColor] hover:shadow-[2px_2px_0px_0px_currentColor] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none font-bold"
          >
            $ back
          </Button>
          <Button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/signup")}
            className="bg-foreground text-background border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-background hover:text-foreground hover:shadow-[4px_4px_0px_0px_currentColor] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none font-bold"
          >
            {isAuthenticated ? "$ dashboard" : "$ sign_up"}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12 border-b border-border pb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">$ pricing_plans</h1>
          <p className="text-muted-foreground text-sm">Choose the plan that fits your game development needs</p>
        </div>

        {/* Pricing Cards */}
        {pricingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              // Find matching database plan for price
              // const dbPlanName = planNameMap[plan.name] // unused
              // const dbPlan = dbPlans.find((p) => p.name === dbPlanName) // unused

              return (
                <div
                  key={plan.name}
                  className={`
                bg-background border-2 border-border
                flex flex-col
                transition-all
                ${plan.highlight ? "scale-105 shadow-2xl" : "hover:shadow-lg"}
              `}
                >
                  {/* Plan Header */}
                  <div className="border-b border-border p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
                      {plan.highlight && (
                        <span className="text-xs bg-foreground text-background px-2 py-1 font-mono font-bold">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-foreground">{plan.price}</div>
                      <div className="text-sm text-muted-foreground">{plan.priceUsd}</div>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="flex-1 p-6 space-y-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                        <span className="text-xs text-foreground font-mono leading-relaxed">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <div className="p-6 border-t border-border">
                    {subscription && subscription.planName === planNameMap[plan.name] && subscription.status === "active" ? (
                      <div className="w-full px-4 py-2 bg-green-100 dark:bg-green-900 border-2 border-green-600 text-green-800 dark:text-green-100 text-center text-sm font-mono">
                        $ current_plan
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGetStarted(plan.name)}
                        disabled={processingPlan === plan.name}
                        className={`
                      w-full font-mono text-sm
                      ${plan.highlight
                            ? "bg-foreground text-background hover:bg-muted-foreground border-2 border-foreground disabled:opacity-50"
                            : "bg-background text-foreground hover:bg-muted border-2 border-foreground disabled:opacity-50"
                          }
                    `}
                      >
                        {processingPlan === plan.name ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            $ processing...
                          </span>
                        ) : plan.name === "STUDIO" ? (
                          "$ contact_sales"
                        ) : (
                          "$ get_started"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border-2 border-red-500 rounded text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-mono">{error}</p>
          </div>
        )}

        {/* Credit Top-Up Packs */}
        <div className="mt-16 border-t border-border pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">$ credit_topups</h2>
            <p className="text-sm text-muted-foreground">Need more credits? Buy top-up packs anytime</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* $5 Pack */}
            <div className="border-2 border-border p-6 hover:shadow-lg transition-all">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-foreground mb-2">$5</div>
                <div className="text-sm text-muted-foreground">₹375</div>
              </div>
              <div className="border-t border-border pt-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">500</div>
                  <div className="text-xs text-muted-foreground">credits</div>
                </div>
              </div>
              <Button
                onClick={() => alert("Top-up feature coming soon!")}
                className="w-full bg-background text-foreground border-2 border-foreground hover:bg-foreground hover:text-background transition-colors font-mono text-sm"
              >
                $ buy_now
              </Button>
            </div>

            {/* $10 Pack */}
            <div className="border-2 border-foreground p-6 hover:shadow-lg transition-all bg-foreground text-background">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold mb-2">$10</div>
                <div className="text-sm text-background/60">₹750</div>
              </div>
              <div className="border-t border-background pt-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">1,200</div>
                  <div className="text-xs text-background/60">credits</div>
                  <div className="text-xs text-green-400 mt-1">+20% bonus</div>
                </div>
              </div>
              <Button
                onClick={() => alert("Top-up feature coming soon!")}
                className="w-full bg-background text-foreground border-2 border-background hover:bg-background/90 transition-colors font-mono text-sm"
              >
                $ buy_now
              </Button>
            </div>

            {/* $20 Pack */}
            <div className="border-2 border-border p-6 hover:shadow-lg transition-all">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-foreground mb-2">$20</div>
                <div className="text-sm text-muted-foreground">₹1,500</div>
              </div>
              <div className="border-t border-border pt-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">3,000</div>
                  <div className="text-xs text-muted-foreground">credits</div>
                  <div className="text-xs text-green-600 mt-1">+50% bonus</div>
                </div>
              </div>
              <Button
                onClick={() => alert("Top-up feature coming soon!")}
                className="w-full bg-background text-foreground border-2 border-foreground hover:bg-foreground hover:text-background transition-colors font-mono text-sm"
              >
                $ buy_now
              </Button>
            </div>
          </div>
        </div>

        {/* Credit Costs Information */}
        <div className="mt-16 border-t border-border pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">$ credit_costs</h2>
            <p className="text-sm text-muted-foreground">How your credits are consumed</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Image Generation */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 shrink-0" />
                Image Generation
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Standard (koye2dv1)</span>
                  <span className="font-bold">5 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">HQ (koye2dv1.5)</span>
                  <span className="font-bold">10 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Ultra (koye2dv2)</span>
                  <span className="font-bold">15 credits</span>
                </div>
              </div>
            </div>

            {/* 3D Models */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 shrink-0" />
                3D Models (koye 3d v1)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Basic (512)</span>
                  <span className="font-bold">20 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Standard (1024)</span>
                  <span className="font-bold">50 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">High-Res (1536)</span>
                  <span className="font-bold">70 credits</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">+5/10/20 credits for textures</p>
              </div>
            </div>

            {/* Rigging & Animation */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 shrink-0" />
                Rigging & Animation
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Auto-Rig</span>
                  <span className="font-bold">10 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Animation</span>
                  <span className="font-bold">30 credits/animation</span>
                </div>
              </div>
            </div>

            {/* Audio & Video */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 shrink-0" />
                Audio & Video
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Audio (per sec)</span>
                  <span className="font-bold">5 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Video 720p (per sec)</span>
                  <span className="font-bold">10 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Video 1080p (per sec)</span>
                  <span className="font-bold">25 credits</span>
                </div>
              </div>
            </div>

            {/* Game Generation */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 shrink-0" />
                Game Generation (AI builder)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">2D Prototype</span>
                  <span className="font-bold">100 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">3D Prototype</span>
                  <span className="font-bold">250 credits</span>
                </div>
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Full Small Game</span>
                  <span className="font-bold">500 credits</span>
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="border-2 border-border p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 shrink-0" />
                AI Chat
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span className="font-mono">Chat Messages</span>
                  <span className="font-bold">100 credits/M tokens</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground font-mono">
            $ all_plans_include_community_support
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-2">
            $ custom_enterprise_solutions_available
          </p>
        </div>
      </div>
    </div>
  )
}


