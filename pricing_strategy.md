# New Credit-Based Pricing Strategy

## Overview
Moving from fixed daily limits to a flexible **Credit System**. Users purchase or subscribe to get a monthly allowance of credits, which they can spend on any feature they choose. This offers more flexibility than rigid daily caps.

## Credit Consumption Rates (Draft)

| Feature | Action | Cost (Credits) | Notes |
| :--- | :--- | :--- | :--- |
| **Chat** | Text Generation | 0.1 / message | Effectively unlimited for most users |
| **Image Gen** | Standard (koye-2dv1) | 1 / image | Fast, standard quality |
| **Image Gen** | High Quality (koye-2dv2) | 2 / image | Higher detail, slower |
| **3D Conversion** | 2D to 3D Model | 10 / model | Computationally expensive |
| **Rigging** | Auto-Rigging | 5 / rig | Standard humanoid rig |
| **Rigging** | Advanced Rigging | 10 / rig | Includes fingers, face, etc. |
| **Animation** | 720p Generation | 20 / sec | Video generation |
| **Animation** | 1080p Generation | 40 / sec | High res video |
| **Animation** | 4K Generation | 100 / sec | Ultra high res |

## Proposed Plans

### 1. PRO Plan
*Target: Indie Developers & Hobbyists*
- **Price**: ₹999 / month ($14.99)
- **Credits**: **2,500 Credits / month**
- **Equivalent To**:
    - ~2,500 Standard Images
    - OR ~1,250 HQ Images
    - OR ~250 3D Models
- **Features**:
    - Access to all Standard features
    - Priority Processing: Standard
    - Storage: 20GB
    - Commercial License

### 2. PRO_PLUS Plan
*Target: Professional Creators*
- **Price**: ₹1,999 / month ($29.99)
- **Credits**: **6,000 Credits / month**
- **Equivalent To**:
    - ~6,000 Standard Images
    - OR ~3,000 HQ Images
    - OR ~600 3D Models
- **Features**:
    - Everything in PRO
    - Priority Processing: High
    - Storage: 100GB
    - Early Access features
    - Custom Export Presets

### 3. ULTRA Plan
*Target: Power Users & Micro-Studios*
- **Price**: ₹4,999 / month ($69.99)
- **Credits**: **16,000 Credits / month**
- **Equivalent To**:
    - ~16,000 Standard Images
    - OR ~8,000 HQ Images
    - OR ~1,600 3D Models
- **Features**:
    - Everything in PRO_PLUS
    - Priority Processing: Ultra (Dedicated GPU Queue)
    - Storage: 500GB
    - 5 Team Seats
    - API Access

### 4. STUDIO Plan
*Target: Large Studios*
- **Price**: ₹49,999+ / month ($999+)
- **Credits**: **Custom / Unlimited**
- **Features**:
    - Custom Credit Volume
    - Private Inference Endpoint
    - SLA & Dedicated Support
    - Unlimited Seats & Storage

## Implementation Changes Required

1.  **Database Schema**:
    - Add `credits_balance` to user/subscription table.
    - Add `monthly_credit_allowance` to plans table.
    - Track `credits_used` in usage logs instead of just counts.

2.  **Backend Logic**:
    - `checkUsageLimit` needs to check `credits_balance >= cost`.
    - `incrementUserUsage` needs to deduct credits: `credits_balance -= cost`.
    - Cron job/Subscription hook to reset/add credits on monthly renewal.

3.  **Frontend**:
    - Display "Credits Remaining" instead of "X/Y used".
    - Show credit cost before expensive actions (e.g., "Generate (2 Credits)").
