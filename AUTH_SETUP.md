# Authentication Setup Guide

## Environment Variables

Add these to your `.env` file in the `my-app` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AUTH_BG_IMAGE=/path/to/your/background/image.jpg
```

### Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy the **Project URL** and **anon/public key**
4. Add them to your `.env` file

### Background Image

- Set `VITE_AUTH_BG_IMAGE` to the path of your background image
- The image will be used with `object-fit: cover` for the auth pages
- You can use a relative path from the `public` folder or an absolute URL
- Example: `VITE_AUTH_BG_IMAGE=/images/auth-bg.jpg` or `VITE_AUTH_BG_IMAGE=https://example.com/bg.jpg`

## SQL Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the SQL from `supabase-auth-setup.sql` file
4. This will create:
   - A `profiles` table for user metadata
   - Row Level Security policies
   - A trigger to auto-create profiles on signup
   - Helper functions

## Supabase Configuration

Make sure to configure the following in your Supabase dashboard:

1. **Authentication > Providers**
   - Enable **Email** provider
   - Configure email settings

2. **Authentication > Email Templates**
   - Customize the confirmation email template if needed
   - Customize the password reset template if needed

3. **Authentication > URL Configuration**
   - Set your **Site URL** (e.g., `http://localhost:5173` for development)
   - Add **Redirect URLs** if needed (e.g., `http://localhost:5173/**`)

## Features

- ✅ Terminal-style sign up page
- ✅ Terminal-style login page
- ✅ Background image support
- ✅ Email/password authentication
- ✅ Automatic profile creation
- ✅ Error handling
- ✅ Loading states
- ✅ Navigation between sign up and login

## Usage

- Click the "Sign up for free" button to navigate to the sign up page
- After signing up, users will receive a confirmation email
- Users can navigate between sign up and login pages
- After successful login, users are redirected to the main app

