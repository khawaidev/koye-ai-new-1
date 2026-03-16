# Email Template Setup Guide

## Terminal-Style Email Confirmation Template

This guide explains how to set up the terminal-style email confirmation template in Supabase.

## Files Included

1. **confirm-email.html** - HTML email template with terminal styling
2. **confirm-email-text.txt** - Plain text fallback version

## Supabase Setup Instructions

### 1. Navigate to Email Templates

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Email Templates**
3. Select **Confirm signup** template

### 2. Configure the HTML Template

Copy the contents of `confirm-email.html` and paste it into the **HTML** field in Supabase.

**Important:** Replace `{{ .Date }}` with the actual date variable if Supabase uses a different format. Common variables:
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email
- `{{ .Token }}` - Confirmation token
- `{{ .TokenHash }}` - Hashed token

### 3. Configure the Plain Text Template

Copy the contents of `confirm-email-text.txt` and paste it into the **Plain text** field in Supabase.

### 4. Available Variables

Supabase provides these variables in email templates:

- `{{ .ConfirmationURL }}` - The confirmation link (automatically generated)
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - Confirmation token
- `{{ .TokenHash }}` - Hashed token
- `{{ .RedirectTo }}` - Redirect URL after confirmation

### 5. Customization

#### Change Colors
- Background: `#ffffff` (white)
- Text: `#000000` (black)
- Borders: `#000000` (black)
- Secondary text: `#666666` (gray)

#### Change Font
The template uses `'Courier New', Courier, monospace` for terminal styling. You can modify this in the `font-family` styles.

#### Add Logo
You can add your app logo by inserting an image tag in the content area:
```html
<img src="YOUR_LOGO_URL" alt="KOYE AI" style="max-width: 200px; height: auto;" />
```

### 6. Testing

1. Use Supabase's **Send test email** feature
2. Check email in different clients:
   - Gmail
   - Outlook
   - Apple Mail
   - Mobile clients

### 7. Email Client Compatibility

The template uses:
- Table-based layout (for Outlook compatibility)
- Inline styles (required for email)
- Web-safe fonts with fallbacks
- Simple HTML structure

### 8. Link Expiration

The template mentions "24 hours" expiration. Adjust this text if your actual expiration time differs. You can configure this in:
- **Authentication** > **URL Configuration** > **JWT expiry**

## Template Features

✅ Terminal-style design matching your app
✅ White background with black borders
✅ Monospace font throughout
✅ Terminal window controls (visual)
✅ Responsive design
✅ Email client compatible
✅ Plain text fallback included

## Notes

- Email clients strip some CSS, so the template uses inline styles
- Some email clients don't support all CSS properties
- Test thoroughly before deploying
- The terminal window controls are visual only (not functional in email)

