# API Fallback Setup Guide

This application now supports multiple API keys with automatic fallback for all major APIs. If one API key fails (due to quota limits, authentication errors, etc.), the system will automatically try the next available key.

## Supported APIs

The following APIs support fallback keys:
- **Gemini API** - `VITE_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY1`, `VITE_GEMINI_API_KEY2`, etc.
- **ClipDrop API** - `VITE_CLIPDROP_API_KEY`, `VITE_CLIPDROP_API_KEY1`, `VITE_CLIPDROP_API_KEY2`, etc.
- **Banana API** - `VITE_BANANA_API_KEY`, `VITE_BANANA_API_KEY1`, `VITE_BANANA_API_KEY2`, etc.
- **HITED3D API** - Uses paired keys (AccessKey + SecretKey):
  - Primary: `VITE_HITEM3D_ACCESS_KEY` + `VITE_HITEM3D_SECRET_KEY`
  - Fallback 1: `VITE_HITEM3D_ACCESS_KEY1` + `VITE_HITEM3D_SECRET_KEY1`
  - Fallback 2: `VITE_HITEM3D_ACCESS_KEY2` + `VITE_HITEM3D_SECRET_KEY2`, etc.

## How It Works

1. **Primary Key**: The system first tries the primary key (e.g., `VITE_GEMINI_API_KEY`)
2. **Fallback Keys**: If the primary key fails with a retryable error (401, 403, 429, quota exceeded, etc.), it automatically tries `VITE_GEMINI_API_KEY1`, then `VITE_GEMINI_API_KEY2`, and so on
3. **Maximum Fallbacks**: Up to 10 fallback keys are supported per API (KEY1 through KEY10)
4. **Error Handling**: Only retryable errors trigger fallback. Non-retryable errors (like invalid requests) are thrown immediately

## Example .env Configuration

```env
# Primary keys
VITE_GEMINI_API_KEY=your_primary_gemini_key
VITE_CLIPDROP_API_KEY=your_primary_clipdrop_key
VITE_BANANA_API_KEY=your_primary_banana_key

# HITED3D uses paired keys (AccessKey + SecretKey)
VITE_HITEM3D_ACCESS_KEY=your_primary_access_key
VITE_HITEM3D_SECRET_KEY=your_primary_secret_key

# Fallback keys (optional)
VITE_GEMINI_API_KEY1=your_backup_gemini_key_1
VITE_GEMINI_API_KEY2=your_backup_gemini_key_2
VITE_CLIPDROP_API_KEY1=your_backup_clipdrop_key_1
VITE_BANANA_API_KEY1=your_backup_banana_key_1

# HITED3D fallback pairs (both keys must be provided together)
VITE_HITEM3D_ACCESS_KEY1=your_backup_access_key_1
VITE_HITEM3D_SECRET_KEY1=your_backup_secret_key_1
VITE_HITEM3D_ACCESS_KEY2=your_backup_access_key_2
VITE_HITEM3D_SECRET_KEY2=your_backup_secret_key_2
```

## Retryable Errors

The fallback system automatically retries on these errors:
- **401 Unauthorized** - Invalid or expired API key
- **403 Forbidden** - API key doesn't have required permissions
- **429 Too Many Requests** - Rate limit exceeded
- **Quota Exceeded** - API quota has been reached
- **Invalid API Key** - API key format is invalid

## Benefits

1. **High Availability**: If one API key hits quota limits, the system automatically uses backup keys
2. **Load Distribution**: Distribute requests across multiple API keys to avoid rate limits
3. **Fault Tolerance**: Automatic recovery from temporary API key issues
4. **No Code Changes**: Works transparently - no changes needed in your application code

## Notes

- Fallback keys are tried in order (KEY1, KEY2, KEY3, etc.)
- The system logs which key is being used when a fallback occurs
- All keys must be valid - invalid keys will cause the fallback to continue to the next key
- The primary key is always tried first

