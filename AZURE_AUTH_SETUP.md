# Azure AD (Microsoft OAuth) Setup

This guide describes how to configure Microsoft OAuth for Vanderbilt-only access
using a multi-tenant Azure AD app registration. Vanderbilt SSO admin access is
not required; the app validates `@vanderbilt.edu` emails in code after login.

## Overview

- **App type**: Single-page application (SPA)
- **Tenant**: Multi-tenant (`common`)
- **Flow**: OAuth redirect flow
- **Access**: Validate Vanderbilt email domain in the backend
- **Profile data**: Name, email, profile photo (via Microsoft Graph)

## 1) Create an Azure AD App Registration

1. Go to the Azure portal: https://portal.azure.com
2. Open **Microsoft Entra ID** (Azure Active Directory).
3. Select **App registrations** > **New registration**.
4. Configure:
   - **Name**: `Courseflix`
   - **Supported account types**: **Accounts in any organizational directory**
     (multi-tenant)
   - **Redirect URI**:
     - Type: **Single-page application (SPA)**
     - URI (local dev): `http://localhost:5173` (must match exactly; no trailing slash if you registered it that way)
5. Click **Register**.

## 2) Capture App Identifiers

From the app's **Overview** page:

- **Application (client) ID** -> `VITE_MICROSOFT_CLIENT_ID` and
  `MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** -> not required for multi-tenant; use `common`

## 3) Configure Authentication

1. Open **Authentication** in the app registration.
2. Under **Platform configurations**, ensure you have a **Single-page
   application** entry.
3. Add redirect URIs for your environments:
   - Local dev: `http://localhost:5173/login`
   - Production: `https://<your-frontend-domain>/`
4. Enable:
   - **Access tokens** (for MS Graph)
   - **ID tokens** (for sign-in)
5. Save changes.

## 4) Configure API Permissions

1. Open **API permissions**.
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**.
3. Add:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
4. Click **Add permissions**.

Note: These permissions do not require admin consent for basic profile access.

## 5) (Optional) Add Additional Redirect URIs

If you deploy to multiple environments, add all frontend URLs here. Microsoft
only allows redirects to registered URIs.

## 6) Backend Vanderbilt-Only Validation

Because this is a multi-tenant app, **any Microsoft account** can log in.
The backend must enforce Vanderbilt-only access:

```python
def is_vanderbilt_email(email: str) -> bool:
    return email.lower().endswith("@vanderbilt.edu")
```

If the email does not match, reject the login and do not create a user.

## 7) Environment Variables

Add these variables to your environment:

### Backend

```bash
MICROSOFT_CLIENT_ID=your-azure-client-id
```

### Frontend

```bash
VITE_MICROSOFT_CLIENT_ID=your-azure-client-id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/login
```

Note: The tenant ID (`common`) is hardcoded in the application since we always
use multi-tenant authentication with email validation.

## 7b) Backend Login Endpoint

The frontend sends the Microsoft `idToken` to the backend:

- `POST /api/auth/microsoft/login` with `{ "idToken": "<token>" }`

The backend verifies the token signature and enforces `@vanderbilt.edu`.

## 8) Fetching Profile Data and Photos

After login, use Microsoft Graph to fetch profile data and the avatar:

- **Profile**: `GET https://graph.microsoft.com/v1.0/me`
- **Photo**: `GET https://graph.microsoft.com/v1.0/me/photo/$value`

These endpoints are free for basic usage and are well within rate limits for
VandyGuessr. Recommended practice is to store the returned data in MongoDB and
avoid re-fetching on every request.

## 9) Rate Limits (Practical Notes)

Microsoft Graph rate limits for user profile and photo endpoints are generous
(typically ~10,000 requests per 10 minutes per app). VandyGuessr will be far
below these limits when fetching profile data only on login.

## 10) Troubleshooting

- **AADSTS50011**: Redirect URI mismatch
  - Ensure the exact redirect URI is registered in Azure.
- **Missing email**: Use `preferred_username` if `email` is absent.
- **Forbidden photo**: If photo access fails, fall back to initials/default.
