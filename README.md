# HOMBRE — High-Performance UID Bypass Gateway & API Proxy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jaanuurs2-jpg/hombre-uid-gateway)

Sub-50ms reverse proxy gateway with air-gapped master credentials, custom HOMBRE prefix key generation, and strict UID limit quota enforcement.

## 🚀 1-Click Deploy to Render

Click the button below to instantly deploy your instance on Render with free SSL:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jaanuurs2-jpg/hombre-uid-gateway)

---

## 🔐 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server listening port | `3000` (Render sets automatically) |
| `MASTER_API_URL` | Upstream target endpoint | `https://mani272uidbypass.vercel.app/api/v1/uids/add` |
| `MASTER_API_KEY` | Air-gapped master key | `MANI272-F5523A6A44D1FB13C5F8C71A9C4A64BE` |
| `DEFAULT_PREFIX` | Prefix for generated keys | `HOMBRE` |
| `ADMIN_PASSWORD` | Admin console secret password | `hombre123` |

---

## 📡 API Usage

### Forwarding Endpoint
`POST /api/v1/uids/add`

#### Headers
```http
Content-Type: application/json
X-AUTH-KEY: HOMBRE-XXXX-XXXX-XXXX
```

#### Request Body
```json
{
  "uid": "123456789",
  "days": 30,
  "name": "PlayerOne"
}
```

#### Quota Enforcement
When a key exceeds its allocated UID limit, the gateway immediately returns:
```json
{
  "success": false,
  "error": "UID Limit Reached: This key has already registered its maximum quota of 10 UIDs (10/10 used). Further requests are blocked.",
  "limit": 10,
  "used": 10
}
```

---

## 🛡️ Secret Admin Vault
Press `Ctrl + Shift + V` on the landing page to unlock the admin console with password `hombre123`.
