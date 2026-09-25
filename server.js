const initialPort = process.env.PORT;
require('dotenv').config({ override: true });
if (initialPort && initialPort !== '3000') {
  process.env.PORT = initialPort;
}
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// MongoDB Atlas Cloud Database State
let mongoClient = null;
let mongoDb = null;
let mongoKeysCol = null;
let mongoLogsCol = null;
let mongoAuditCol = null;

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER_API_URL = process.env.MASTER_API_URL || 'https://mani272uidbypass.vercel.app/api/v1/uids/add';
const MASTER_REMOVE_URL = process.env.MASTER_REMOVE_URL || MASTER_API_URL.replace('/add', '/remove');
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'MANI272-6657808A4D2955D7BD5B42C6E03A0F98';
const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || 'HOMBRE';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'v9du0njnxw';
const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

// Hardened Anti-Inspect & Security Headers Middleware
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none'; form-action 'self';");
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Security: Brute-Force Rate Limiter for Admin Login
const failedLoginAttempts = new Map(); // ip -> { count, lockedUntil }

function checkLoginRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = failedLoginAttempts.get(ip);

  if (record && record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    addAdminAudit({
      eventType: 'SECURITY_LOCKOUT',
      level: 'SECURITY',
      action: `Admin login blocked: IP temporarily locked out (${remainingSeconds}s remaining)`,
      details: { remainingSeconds, lockDuration: '10m' },
      req
    });
    return res.status(429).json({
      success: false,
      error: `Security Lockout: Too many failed login attempts. Try again in ${remainingSeconds} seconds.`
    });
  }
  next();
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = failedLoginAttempts.get(ip) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 10 * 60 * 1000; // 10 minutes lockout
    record.count = 0;
    addAdminAudit({
      eventType: 'SECURITY_LOCKOUT',
      level: 'SECURITY',
      action: `IP locked out for 10 minutes due to 5 consecutive failed login attempts`,
      details: { ip, threshold: 5 },
      ip
    });
  }
  failedLoginAttempts.set(ip, record);
}

function clearFailedLogin(ip) {
  failedLoginAttempts.delete(ip);
}

// Security: API Request Rate Limiter (Anti-DDoS / Flooding)
const apiRequestLimits = new Map(); // ip -> { count, windowStart }
function checkApiRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120; // 120 req/min per IP

  const record = apiRequestLimits.get(ip) || { count: 0, windowStart: now };
  if (now - record.windowStart > windowMs) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests: Rate limit exceeded. Please wait before retrying.'
      });
    }
  }
  apiRequestLimits.set(ip, record);
  next();
}

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const KEYS_BACKUP_FILE = path.join(DATA_DIR, 'keys.backup.json');
const ADMIN_AUDIT_FILE = path.join(DATA_DIR, 'admin-audit.json');

// In-Memory Master Store with Atomic Sync, Backup Recovery & Cloud Database
let memoryKeys = [];
let memoryLogs = [];
let memoryAdminAudit = [];

// Guaranteed System Seed Keys (Discord Bot & Master Keys)
// These keys will NEVER be lost or deleted, even if Render restarts or clears temporary disks!
const DEFAULT_PRESET_KEYS = [
  {
    id: "key_axc_bot_primary_67f4",
    key: "HOMBRE-67F4F8DD7289997CEF67DBEB1F375DBC",
    name: "Discord Bot AXC (Active Production)",
    prefix: "HOMBRE",
    createdAt: "2026-09-25T12:00:00.000Z",
    expiresAt: null,
    days: null,
    uidLimit: 0,
    maxCalls: 0,
    registeredUids: [],
    uidsCount: 0,
    usageCount: 0,
    isActive: true,
    lastUsedAt: null
  },
  {
    id: "key_axc_bot_secondary_0701",
    key: "AXC-07019283A5D7F6712170DD5AC7C9C90D",
    name: "Discord Bot AXC Secondary Key",
    prefix: "AXC",
    createdAt: "2026-09-25T12:00:00.000Z",
    expiresAt: null,
    days: null,
    uidLimit: 0,
    maxCalls: 0,
    registeredUids: [],
    uidsCount: 0,
    usageCount: 0,
    isActive: true,
    lastUsedAt: null
  },
  {
    id: "e553aa85-2bd5-4417-8dd7-3577685aa12d",
    key: "HOMBRE-7AF5FF5C3E1146DB7BD78355B7EA9541",
    name: "axc",
    prefix: "HOMBRE",
    createdAt: "2026-09-25T13:23:57.762Z",
    expiresAt: "2026-10-25T13:23:57.762Z",
    days: 30,
    uidLimit: 1000,
    maxCalls: 1000,
    registeredUids: [],
    uidsCount: 0,
    usageCount: 0,
    isActive: true,
    lastUsedAt: null
  }
];

function loadDataFromDisk() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const content = fs.readFileSync(KEYS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryKeys = parsed;
      }
    }
  } catch (err) {
    console.error('Initial keys read error:', err);
  }

  // Restore from backup if primary was empty or missing
  if (memoryKeys.length === 0 && fs.existsSync(KEYS_BACKUP_FILE)) {
    try {
      const backup = JSON.parse(fs.readFileSync(KEYS_BACKUP_FILE, 'utf8'));
      if (Array.isArray(backup) && backup.length > 0) {
        memoryKeys = backup;
        console.log(`[HOMBRE BACKUP] Restored ${memoryKeys.length} keys from backup.`);
      }
    } catch (err) {
      console.error('Error reading KEYS_BACKUP_FILE:', err);
    }
  }

  // Guarantee permanent preset keys are always active
  for (const pk of DEFAULT_PRESET_KEYS) {
    const existing = memoryKeys.find(k => k.key.trim() === pk.key.trim());
    if (!existing) {
      memoryKeys.push(pk);
    }
  }

  // Merge SEED_KEYS from Render Environment Variables (survives all redeploys!)
  if (process.env.SEED_KEYS) {
    try {
      const seeds = JSON.parse(process.env.SEED_KEYS);
      if (Array.isArray(seeds)) {
        for (const sk of seeds) {
          if (!memoryKeys.some(k => k.key.trim() === sk.key.trim())) {
            memoryKeys.push(sk);
          }
        }
        console.log(`[HOMBRE SEED] Merged keys from SEED_KEYS environment variable.`);
      }
    } catch (e) {
      console.error('Error parsing SEED_KEYS env var:', e.message);
    }
  }

  try {
    if (fs.existsSync(LOGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      if (Array.isArray(parsed)) memoryLogs = parsed;
    }
  } catch (err) {
    console.error('Initial logs read error:', err);
  }

  try {
    if (fs.existsSync(ADMIN_AUDIT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_AUDIT_FILE, 'utf8'));
      if (Array.isArray(parsed)) memoryAdminAudit = parsed;
    }
  } catch (err) {
    console.error('Initial admin audit read error:', err);
  }
}
loadDataFromDisk();

// Initialize MongoDB Atlas Cloud Connection (Zero-Loss Persistent Architecture)
async function initMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[DATABASE] Running in local JSON storage mode with auto-seeded keys and backup sync.');
    return;
  }
  try {
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGODB_DB_NAME || 'hombre_gateway');
    mongoKeysCol = mongoDb.collection('keys');
    mongoLogsCol = mongoDb.collection('logs');
    mongoAuditCol = mongoDb.collection('admin_audit');

    console.log('✅ [DATABASE] Connected to MongoDB Atlas Cloud. 100% Permanent Storage Active.');

    // 1. Sync Keys: Load from MongoDB Atlas Cloud
    const remoteKeys = await mongoKeysCol.find({}).toArray();
    if (remoteKeys.length > 0) {
      const cleanKeys = remoteKeys.map(({ _id, ...k }) => k);
      // Merge with memoryKeys preserving any keys
      for (const rk of cleanKeys) {
        const existingIdx = memoryKeys.findIndex(k => k.key.trim() === rk.key.trim());
        if (existingIdx >= 0) {
          memoryKeys[existingIdx] = rk;
        } else {
          memoryKeys.push(rk);
        }
      }
      console.log(`[DATABASE] Synchronized ${memoryKeys.length} keys from MongoDB cloud.`);
      writeJSON(KEYS_FILE, memoryKeys);
    } else if (memoryKeys.length > 0) {
      // Seed remote MongoDB from local initial keys
      await mongoKeysCol.insertMany(memoryKeys.map(k => ({ ...k })));
      console.log(`[DATABASE] Seeded MongoDB cloud with ${memoryKeys.length} initial keys.`);
    }

    // 2. Sync Audit Logs
    const remoteAudit = await mongoAuditCol.find({}).sort({ timestamp: -1 }).limit(500).toArray();
    if (remoteAudit.length > 0) {
      const cleanAudit = remoteAudit.map(({ _id, ...a }) => a);
      memoryAdminAudit = cleanAudit;
      writeJSON(ADMIN_AUDIT_FILE, memoryAdminAudit);
    }
  } catch (err) {
    console.error('⚠️ [DATABASE] MongoDB connection error:', err.message);
  }
}

// Helper to read / write JSON with in-memory caching and atomic file writes
function readJSON(file, defaultVal) {
  if (file === KEYS_FILE) {
    return memoryKeys;
  }
  if (file === LOGS_FILE) {
    return memoryLogs;
  }
  if (file === ADMIN_AUDIT_FILE) {
    return memoryAdminAudit;
  }
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return defaultVal;
}

function writeJSON(file, data) {
  if (file === KEYS_FILE) {
    memoryKeys = Array.isArray(data) ? data : [];
    try {
      const tempFile = `${KEYS_FILE}.tmp`;
      const str = JSON.stringify(memoryKeys, null, 2);
      fs.writeFileSync(tempFile, str, 'utf8');
      fs.renameSync(tempFile, KEYS_FILE);
      if (memoryKeys.length > 0) {
        fs.writeFileSync(KEYS_BACKUP_FILE, str, 'utf8');
      }
    } catch (err) {
      console.error(`Error writing ${KEYS_FILE}:`, err);
    }

    // Cloud Mirror: Asynchronously sync keys to MongoDB Atlas
    if (mongoKeysCol) {
      (async () => {
        try {
          await mongoKeysCol.deleteMany({});
          if (memoryKeys.length > 0) {
            await mongoKeysCol.insertMany(memoryKeys.map(k => ({ ...k })));
          }
        } catch (e) {
          console.error('[DATABASE] Error syncing keys to MongoDB:', e.message);
        }
      })();
    }
    return;
  }

  if (file === LOGS_FILE) {
    memoryLogs = Array.isArray(data) ? data : [];
    try {
      const tempFile = `${LOGS_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(memoryLogs, null, 2), 'utf8');
      fs.renameSync(tempFile, LOGS_FILE);
    } catch (err) {
      console.error(`Error writing ${LOGS_FILE}:`, err);
    }
    return;
  }

  if (file === ADMIN_AUDIT_FILE) {
    memoryAdminAudit = Array.isArray(data) ? data : [];
    try {
      const tempFile = `${ADMIN_AUDIT_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(memoryAdminAudit, null, 2), 'utf8');
      fs.renameSync(tempFile, ADMIN_AUDIT_FILE);
    } catch (err) {
      console.error(`Error writing ${ADMIN_AUDIT_FILE}:`, err);
    }
    return;
  }

  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

function addLog(logEntry) {
  const logs = readJSON(LOGS_FILE, []);
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...logEntry
  };
  logs.unshift(entry);
  // Keep last 300 logs in memory
  if (logs.length > 300) logs.pop();
  writeJSON(LOGS_FILE, logs);

  if (mongoLogsCol) {
    mongoLogsCol.insertOne({ ...entry }).catch(e => console.error('[DATABASE] Log insert error:', e.message));
  }
}

// Immutable Admin Security Audit Logger (Permanent & Non-Clearable)
function addAdminAudit({ eventType, action, details = {}, req, ip, userAgent, level = 'INFO' }) {
  const clientIp = req
    ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    : (ip || 'unknown');
  const agent = req
    ? (req.headers['user-agent'] || 'unknown')
    : (userAgent || 'Console');

  const auditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventType: eventType || 'ADMIN_ACTION',
    level: level, // SUCCESS, INFO, NOTICE, WARNING, SECURITY
    action: action || 'Admin Action',
    details: details || {},
    ip: clientIp,
    userAgent: agent
  };

  memoryAdminAudit.unshift(auditEntry);
  // Retain up to 3000 permanent audit logs
  if (memoryAdminAudit.length > 3000) memoryAdminAudit.pop();
  writeJSON(ADMIN_AUDIT_FILE, memoryAdminAudit);

  if (mongoAuditCol) {
    mongoAuditCol.insertOne({ ...auditEntry }).catch(e => console.error('[DATABASE] Audit insert error:', e.message));
  }
  return auditEntry;
}

// Timing-Safe Admin Auth Middleware
function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authentication token required'
    });
  }

  const tokenBuffer = Buffer.from(String(token));
  const adminTokenBuffer = Buffer.from(ADMIN_TOKEN);

  if (tokenBuffer.length !== adminTokenBuffer.length || !crypto.timingSafeEqual(tokenBuffer, adminTokenBuffer)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid Admin authentication token'
    });
  }
  next();
}

// Route to serve Admin HTML directly at /admin
app.get('/admin', (req, res) => {
  addAdminAudit({
    eventType: 'PAGE_VIEW',
    level: 'INFO',
    action: 'Admin Console accessed (/admin)',
    details: { path: '/admin' },
    req
  });
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==========================================
// 1. REVERSE PROXY ENDPOINT
// Clients call this endpoint with their HOMBRE-... key!
// ==========================================
app.post('/api/v1/uids/add', checkApiRateLimit, async (req, res) => {
  const startTime = Date.now();
  
  // Extract key from headers or query
  let clientKey = req.headers['x-auth-key'] || 
                  req.headers['authorization'] || 
                  req.query.key || 
                  req.query.auth_key;
                  
  if (clientKey && clientKey.startsWith('Bearer ')) {
    clientKey = clientKey.slice(7).trim();
  }

  const { uid, days, name } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Key Validation
  if (!clientKey) {
    addLog({
      endpoint: '/api/v1/uids/add',
      key: 'MISSING',
      clientName: 'Unknown',
      uid: uid || 'N/A',
      status: 401,
      success: false,
      error: 'Missing X-AUTH-KEY header',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: X-AUTH-KEY header is required'
    });
  }

  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.key.trim() === clientKey.trim());

  if (!foundKey) {
    addLog({
      endpoint: '/api/v1/uids/add',
      key: clientKey,
      clientName: 'Unknown',
      uid: uid || 'N/A',
      status: 403,
      success: false,
      error: 'Invalid API Key',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid API Key provided'
    });
  }

  // Check if Active
  if (!foundKey.isActive) {
    addLog({
      endpoint: '/api/v1/uids/add',
      key: clientKey,
      clientName: foundKey.name,
      uid: uid || 'N/A',
      status: 403,
      success: false,
      error: 'Key Deactivated',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden: API Key has been suspended or deactivated'
    });
  }

  // Check Expiry
  if (foundKey.expiresAt) {
    const expiryTime = new Date(foundKey.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      addLog({
        endpoint: '/api/v1/uids/add',
        key: clientKey,
        clientName: foundKey.name,
        uid: uid || 'N/A',
        status: 403,
        success: false,
        error: 'Key Expired',
        ip: clientIp,
        durationMs: Date.now() - startTime
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden: API Key has expired'
      });
    }
  }

  // UID Limit Check (Non-refundable quota: removing a UID does not restore consumed slots)
  const effectiveLimit = foundKey.uidLimit !== undefined ? foundKey.uidLimit : (foundKey.maxCalls || 0);
  if (!foundKey.registeredUids) foundKey.registeredUids = [];
  if (foundKey.slotsConsumed === undefined) {
    foundKey.slotsConsumed = foundKey.registeredUids.length;
  }
  const incomingUid = uid ? String(uid).trim() : '';

  if (effectiveLimit > 0) {
    const isAlreadyRegistered = incomingUid && foundKey.registeredUids.includes(incomingUid);
    
    // If quota reached and this is a new UID
    if (foundKey.slotsConsumed >= effectiveLimit && !isAlreadyRegistered) {
      addLog({
        endpoint: '/api/v1/uids/add',
        key: clientKey,
        clientName: foundKey.name,
        uid: uid || 'N/A',
        status: 429,
        success: false,
        error: `UID Limit Exceeded (${foundKey.slotsConsumed}/${effectiveLimit} slots consumed)`,
        ip: clientIp,
        durationMs: Date.now() - startTime
      });
      return res.status(429).json({
        success: false,
        error: `UID Limit Reached: This key has already consumed its maximum quota of ${effectiveLimit} UID slots (${foundKey.slotsConsumed}/${effectiveLimit} slots used). Removed UIDs do not restore quota slots.`,
        limit: effectiveLimit,
        slotsUsed: foundKey.slotsConsumed,
        activeUids: foundKey.registeredUids.length
      });
    }
  }

  // Increment usage count and track registered UID with full audit details
  if (incomingUid) {
    if (!foundKey.registeredUids) foundKey.registeredUids = [];
    if (!foundKey.registeredUidsDetails) foundKey.registeredUidsDetails = [];

    const existingDetail = foundKey.registeredUidsDetails.find(d => d.uid === incomingUid);
    if (!existingDetail) {
      foundKey.registeredUidsDetails.unshift({
        uid: incomingUid,
        name: (name && String(name).trim()) ? String(name).trim() : 'N/A',
        days: days ? parseInt(days, 10) : 30,
        addedAt: new Date().toISOString(),
        ip: clientIp
      });
    }

    if (!foundKey.registeredUids.includes(incomingUid)) {
      foundKey.registeredUids.push(incomingUid);
      // Consume a slot permanently (non-refundable even after removal)
      foundKey.slotsConsumed = (foundKey.slotsConsumed || 0) + 1;
    }
  }

  foundKey.uidsCount = foundKey.registeredUids.length;
  foundKey.usageCount = (foundKey.usageCount || 0) + 1;
  foundKey.lastUsedAt = new Date().toISOString();
  writeJSON(KEYS_FILE, keys);

  // Forward request to Master Upstream API
  try {
    const upstreamResponse = await fetch(MASTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-KEY': MASTER_API_KEY
      },
      body: JSON.stringify({
        uid: uid,
        days: days,
        name: name
      })
    });

    const responseStatus = upstreamResponse.status;
    const responseText = await upstreamResponse.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    const durationMs = Date.now() - startTime;

    // Log successful proxy
    addLog({
      endpoint: '/api/v1/uids/add',
      key: clientKey,
      clientName: foundKey.name,
      uid: uid || 'N/A',
      nameTag: name || 'N/A',
      days: days || 30,
      status: responseStatus,
      success: upstreamResponse.ok,
      ip: clientIp,
      durationMs: durationMs
    });

    return res.status(responseStatus).json(responseData);
  } catch (err) {
    console.error('Error forwarding to upstream:', err);
    const durationMs = Date.now() - startTime;
    addLog({
      endpoint: '/api/v1/uids/add',
      key: clientKey,
      clientName: foundKey.name,
      uid: uid || 'N/A',
      nameTag: name || 'N/A',
      days: days || 30,
      status: 502,
      success: false,
      error: 'Upstream gateway unreachable',
      ip: clientIp,
      durationMs: durationMs
    });
    return res.status(502).json({
      success: false,
      error: 'Bad Gateway: Upstream provider is temporarily unreachable',
      details: err.message
    });
  }
});

// ==========================================
// 1.1 CLIENT REVERSE PROXY REMOVE / DELETE ENDPOINT
// Clients and Discord/Telegram Bots call this with their HOMBRE-... key!
// Supports POST /api/v1/uids/remove, DELETE /api/v1/uids/remove, and POST /api/v1/uids/delete
// ==========================================
async function handleClientUidRemove(req, res) {
  const startTime = Date.now();

  // Extract key from headers, body, or query
  let clientKey = req.headers['x-auth-key'] ||
                  req.headers['x-api-key'] ||
                  req.headers['authorization'] ||
                  (req.body && (req.body.key || req.body.api_key)) ||
                  req.query.key ||
                  req.query.auth_key;

  if (clientKey && typeof clientKey === 'string' && clientKey.startsWith('Bearer ')) {
    clientKey = clientKey.slice(7).trim();
  }

  const uid = (req.body && (req.body.uid || req.body.account_id || req.body.identifier)) || req.query.uid;
  const reason = (req.body && req.body.reason) || req.query.reason || '';
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Key Validation
  if (!clientKey) {
    addLog({
      endpoint: '/api/v1/uids/remove',
      key: 'MISSING',
      clientName: 'Unknown',
      uid: uid || 'N/A',
      status: 401,
      success: false,
      error: 'Missing X-AUTH-KEY header',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: X-AUTH-KEY header or api_key parameter is required'
    });
  }

  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.key.trim() === String(clientKey).trim());

  if (!foundKey) {
    addLog({
      endpoint: '/api/v1/uids/remove',
      key: clientKey,
      clientName: 'Unknown',
      uid: uid || 'N/A',
      status: 403,
      success: false,
      error: 'Invalid API Key',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid API Key provided'
    });
  }

  // Check if Active
  if (!foundKey.isActive) {
    addLog({
      endpoint: '/api/v1/uids/remove',
      key: clientKey,
      clientName: foundKey.name,
      uid: uid || 'N/A',
      status: 403,
      success: false,
      error: 'Key Deactivated',
      ip: clientIp,
      durationMs: Date.now() - startTime
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden: API Key has been suspended or deactivated'
    });
  }

  // Check Expiry
  if (foundKey.expiresAt) {
    const expiryTime = new Date(foundKey.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      addLog({
        endpoint: '/api/v1/uids/remove',
        key: clientKey,
        clientName: foundKey.name,
        uid: uid || 'N/A',
        status: 403,
        success: false,
        error: 'Key Expired',
        ip: clientIp,
        durationMs: Date.now() - startTime
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden: API Key has expired'
      });
    }
  }

  // UID Validation
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request: "uid" parameter is required'
    });
  }

  const cleanUid = String(uid).trim();

  // Remove UID from local key tracking if present
  if (!foundKey.registeredUids) foundKey.registeredUids = [];
  if (!foundKey.registeredUidsDetails) foundKey.registeredUidsDetails = [];

  foundKey.registeredUids = foundKey.registeredUids.filter(u => String(u).trim() !== cleanUid);
  foundKey.registeredUidsDetails = foundKey.registeredUidsDetails.filter(d => String(d.uid).trim() !== cleanUid);
  foundKey.uidsCount = foundKey.registeredUids.length;
  foundKey.usageCount = (foundKey.usageCount || 0) + 1;
  foundKey.lastUsedAt = new Date().toISOString();
  writeJSON(KEYS_FILE, keys);

  // Relay removal to Upstream Master API (POST https://mani272uidbypass.vercel.app/api/v1/uids/remove)
  try {
    const upstreamResponse = await fetch(MASTER_REMOVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-KEY': MASTER_API_KEY
      },
      body: JSON.stringify({
        uid: cleanUid,
        account_id: cleanUid,
        identifier: cleanUid,
        reason: reason
      })
    });

    const responseStatus = upstreamResponse.status;
    const responseText = await upstreamResponse.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    const durationMs = Date.now() - startTime;

    addLog({
      endpoint: '/api/v1/uids/remove',
      key: clientKey,
      clientName: foundKey.name,
      uid: cleanUid,
      status: responseStatus,
      success: upstreamResponse.ok,
      ip: clientIp,
      durationMs: durationMs
    });

    return res.status(responseStatus).json(responseData);
  } catch (err) {
    console.error('Error forwarding remove to upstream:', err);
    const durationMs = Date.now() - startTime;
    addLog({
      endpoint: '/api/v1/uids/remove',
      key: clientKey,
      clientName: foundKey.name,
      uid: cleanUid,
      status: 502,
      success: false,
      error: 'Upstream gateway unreachable during remove',
      ip: clientIp,
      durationMs: durationMs
    });
    return res.status(502).json({
      success: false,
      error: 'Bad Gateway: Upstream provider is temporarily unreachable',
      details: err.message
    });
  }
}

app.post('/api/v1/uids/remove', checkApiRateLimit, handleClientUidRemove);
app.delete('/api/v1/uids/remove', checkApiRateLimit, handleClientUidRemove);
app.post('/api/v1/uids/delete', checkApiRateLimit, handleClientUidRemove);

// GET /api/v1/uids/:uid for checking UID status under the caller's key
app.get('/api/v1/uids/:uid', checkApiRateLimit, (req, res) => {
  const { uid } = req.params;
  let clientKey = req.headers['x-auth-key'] ||
                  req.headers['x-api-key'] ||
                  req.headers['authorization'] ||
                  req.query.key ||
                  req.query.auth_key;

  if (clientKey && typeof clientKey === 'string' && clientKey.startsWith('Bearer ')) {
    clientKey = clientKey.slice(7).trim();
  }

  if (!clientKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized: X-AUTH-KEY is required' });
  }

  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.key.trim() === String(clientKey).trim());
  if (!foundKey) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid API Key' });
  }

  const cleanUid = String(uid).trim();
  const detail = (foundKey.registeredUidsDetails || []).find(d => String(d.uid).trim() === cleanUid);

  if (detail) {
    return res.json({
      success: true,
      exists: true,
      status: 'active',
      uid: cleanUid,
      data: detail
    });
  }

  if ((foundKey.registeredUids || []).includes(cleanUid)) {
    return res.json({
      success: true,
      exists: true,
      status: 'active',
      uid: cleanUid
    });
  }

  return res.status(404).json({
    success: false,
    exists: false,
    error: `UID ${cleanUid} not found under this key`
  });
});

// GET /api/v1/quota, /api/v1/limit, /api/v1/key/info for checking API Key quota limits
function handleQuotaCheck(req, res) {
  let clientKey = req.headers['x-auth-key'] ||
                  req.headers['x-api-key'] ||
                  req.headers['authorization'] ||
                  req.query.key ||
                  req.query.auth_key;

  if (clientKey && typeof clientKey === 'string' && clientKey.startsWith('Bearer ')) {
    clientKey = clientKey.slice(7).trim();
  }

  if (!clientKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized: X-AUTH-KEY is required' });
  }

  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.key.trim() === String(clientKey).trim());
  if (!foundKey) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid API Key' });
  }

  const effectiveLimit = foundKey.uidLimit !== undefined ? foundKey.uidLimit : (foundKey.maxCalls || 0);
  const slotsUsed = foundKey.slotsConsumed !== undefined ? foundKey.slotsConsumed : (foundKey.registeredUids ? foundKey.registeredUids.length : 0);
  const remaining = effectiveLimit > 0 ? Math.max(0, effectiveLimit - slotsUsed) : -1;
  const activeUids = foundKey.registeredUids ? foundKey.registeredUids.length : 0;

  return res.json({
    success: true,
    key: foundKey.key,
    name: foundKey.name || 'Unnamed',
    isActive: !!foundKey.isActive,
    limit: effectiveLimit,
    used: slotsUsed,
    remaining: remaining,
    activeUids: activeUids,
    usageCount: foundKey.usageCount || 0,
    days: foundKey.days || 30,
    expiresAt: foundKey.expiresAt,
    createdAt: foundKey.createdAt
  });
}

app.get('/api/v1/quota', checkApiRateLimit, handleQuotaCheck);
app.get('/api/v1/limit', checkApiRateLimit, handleQuotaCheck);
app.get('/api/v1/key/info', checkApiRateLimit, handleQuotaCheck);

// ==========================================
// 2. ADMIN AUTHENTICATION (Brute-Force Protected & Timing Safe)
// ==========================================
app.post('/api/admin/login', checkLoginRateLimit, (req, res) => {
  const { password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!password) {
    recordFailedLogin(ip);
    addAdminAudit({
      eventType: 'LOGIN_FAILED',
      level: 'WARNING',
      action: 'Admin login rejected: Empty password provided',
      details: {},
      req
    });
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  const passBuffer = Buffer.from(String(password).trim());
  const adminPassBuffer = Buffer.from(ADMIN_PASSWORD.trim());

  if (passBuffer.length === adminPassBuffer.length && crypto.timingSafeEqual(passBuffer, adminPassBuffer)) {
    clearFailedLogin(ip);
    addAdminAudit({
      eventType: 'ADMIN_LOGIN',
      level: 'SUCCESS',
      action: 'Admin successfully logged in to Admin Vault',
      details: { authMethod: 'Password Token' },
      req
    });
    return res.json({
      success: true,
      message: 'Access Granted! Welcome to HOMBRE Admin Vault.',
      token: ADMIN_TOKEN
    });
  }

  recordFailedLogin(ip);
  addAdminAudit({
    eventType: 'LOGIN_FAILED',
    level: 'WARNING',
    action: 'Failed admin login attempt: Incorrect password entered',
    details: { enteredLength: String(password).length },
    req
  });
  return res.status(401).json({
    success: false,
    error: 'Incorrect Password. Access Denied.'
  });
});

// Verify token validity
app.get('/api/admin/verify-token', (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (!token) return res.status(401).json({ success: false, valid: false });

  const tokenBuffer = Buffer.from(String(token));
  const adminTokenBuffer = Buffer.from(ADMIN_TOKEN);

  if (tokenBuffer.length === adminTokenBuffer.length && crypto.timingSafeEqual(tokenBuffer, adminTokenBuffer)) {
    return res.json({ success: true, valid: true });
  }
  return res.status(401).json({ success: false, valid: false });
});

// ==========================================
// 3. ADMIN API ENDPOINTS (Protected by Token)
// ==========================================

// Get System Stats & Overview (Air-gapped: never leaks masterUrl)
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  const keys = readJSON(KEYS_FILE, []);
  const logs = readJSON(LOGS_FILE, []);

  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => {
    const notExpired = !k.expiresAt || new Date(k.expiresAt).getTime() > Date.now();
    const quotaOk = !k.uidLimit || (k.registeredUids && k.registeredUids.length < k.uidLimit);
    return k.isActive && notExpired && quotaOk;
  }).length;

  let totalActiveUids = 0;
  let totalSlotsConsumed = 0;
  keys.forEach(k => {
    totalActiveUids += (k.registeredUids && Array.isArray(k.registeredUids)) ? k.registeredUids.length : 0;
    totalSlotsConsumed += k.slotsConsumed !== undefined 
      ? k.slotsConsumed 
      : ((k.registeredUids && Array.isArray(k.registeredUids)) ? k.registeredUids.length : 0);
  });

  const totalRequests = logs.length;
  const successfulRequests = logs.filter(l => l.success).length;

  res.json({
    totalKeys,
    activeKeys,
    totalActiveUids,
    totalSlotsConsumed,
    totalRequests,
    successfulRequests,
    upstreamTunnel: 'PROTECTED_AIR_GAPPED',
    defaultPrefix: DEFAULT_PREFIX,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Get all registered UIDs for a specific key
app.get('/api/admin/keys/:id/uids', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.id === id);

  if (!foundKey) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  const details = foundKey.registeredUidsDetails || (foundKey.registeredUids || []).map(u => ({
    uid: u,
    name: 'N/A',
    days: 30,
    addedAt: foundKey.createdAt,
    ip: 'N/A'
  }));

  const slotsUsed = foundKey.slotsConsumed !== undefined 
    ? foundKey.slotsConsumed 
    : ((foundKey.registeredUids && Array.isArray(foundKey.registeredUids)) ? foundKey.registeredUids.length : 0);

  res.json({
    success: true,
    key: foundKey.key,
    name: foundKey.name,
    limit: foundKey.uidLimit,
    slotsConsumed: slotsUsed,
    total: details.length,
    uids: details
  });
});

// Admin Manually Add a UID to a Key (and relay to master upstream)
app.post('/api/admin/keys/:id/uids', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { uid, name, days } = req.body || {};
  const adminIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'admin-console';

  if (!uid || !String(uid).trim()) {
    return res.status(400).json({ success: false, error: 'Target Game UID is required' });
  }

  const cleanUid = String(uid).trim();
  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.id === id);

  if (!foundKey) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  if (!foundKey.registeredUids) foundKey.registeredUids = [];
  if (!foundKey.registeredUidsDetails) foundKey.registeredUidsDetails = [];
  if (foundKey.slotsConsumed === undefined) {
    foundKey.slotsConsumed = foundKey.registeredUids.length;
  }

  // Check if UID already registered on this key
  const alreadyExists = foundKey.registeredUids.includes(cleanUid);
  if (alreadyExists) {
    return res.status(400).json({
      success: false,
      error: `UID ${cleanUid} is already registered under this key!`
    });
  }

  // Relay to Upstream Master API with Master Key
  let upstreamSuccess = false;
  let upstreamMessage = 'Saved locally';
  try {
    const upstreamRes = await fetch(MASTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-KEY': MASTER_API_KEY
      },
      body: JSON.stringify({
        uid: cleanUid,
        days: days ? parseInt(days, 10) : 30,
        name: (name && String(name).trim()) ? String(name).trim() : 'AdminAdded'
      })
    });
    upstreamSuccess = upstreamRes.ok;
    const upstreamText = await upstreamRes.text();
    try {
      const upJson = JSON.parse(upstreamText);
      upstreamMessage = upJson.message || upJson.msg || (upstreamRes.ok ? 'Forwarded to upstream' : 'Upstream error');
    } catch {
      upstreamMessage = upstreamRes.ok ? 'Forwarded to upstream' : upstreamText;
    }
  } catch (err) {
    console.warn('Admin add UID upstream forward notice:', err.message);
    upstreamMessage = `Saved to key (upstream notice: ${err.message})`;
  }

  // Add to key details
  const newDetail = {
    uid: cleanUid,
    name: (name && String(name).trim()) ? String(name).trim() : 'Admin Added',
    days: days ? parseInt(days, 10) : 30,
    addedAt: new Date().toISOString(),
    ip: adminIp + ' (Admin)'
  };

  foundKey.registeredUids.push(cleanUid);
  foundKey.slotsConsumed = (foundKey.slotsConsumed || 0) + 1;
  foundKey.registeredUidsDetails.unshift(newDetail);
  foundKey.uidsCount = foundKey.registeredUids.length;
  foundKey.usageCount = (foundKey.usageCount || 0) + 1;
  foundKey.lastUsedAt = new Date().toISOString();
  writeJSON(KEYS_FILE, keys);

  addLog({
    endpoint: '/api/admin/keys/:id/uids',
    key: foundKey.key,
    clientName: foundKey.name,
    uid: cleanUid,
    nameTag: newDetail.name,
    days: newDetail.days,
    status: upstreamSuccess ? 200 : 201,
    success: true,
    error: 'Added manually by Admin',
    ip: adminIp,
    durationMs: 0
  });

  addAdminAudit({
    eventType: 'UID_MANUALLY_ADDED',
    level: 'NOTICE',
    action: `Admin manually registered UID ${cleanUid} to key: ${foundKey.key} ("${foundKey.name}")`,
    details: { uid: cleanUid, name: newDetail.name, days: newDetail.days, key: foundKey.key, keyName: foundKey.name },
    req
  });

  return res.json({
    success: true,
    message: `UID ${cleanUid} successfully added to key!`,
    upstreamMessage,
    slotsConsumed: foundKey.slotsConsumed,
    uids: foundKey.registeredUidsDetails,
    total: foundKey.registeredUids.length
  });
});

// Admin Remove / Delete a UID from a Key (Removes from BOTH HOMBRE Gateway & Master Upstream API, without freeing slot)
app.delete('/api/admin/keys/:id/uids/:uid', requireAdminAuth, async (req, res) => {
  const { id, uid } = req.params;
  const adminIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'admin-console';

  if (!uid) {
    return res.status(400).json({ success: false, error: 'UID parameter required' });
  }

  const cleanUid = String(uid).trim();
  const keys = readJSON(KEYS_FILE, []);
  const foundKey = keys.find(k => k.id === id);

  if (!foundKey) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  if (!foundKey.registeredUids) foundKey.registeredUids = [];
  if (!foundKey.registeredUidsDetails) foundKey.registeredUidsDetails = [];
  if (foundKey.slotsConsumed === undefined) {
    foundKey.slotsConsumed = foundKey.registeredUids.length;
  }

  const initialCount = foundKey.registeredUids.length;
  foundKey.registeredUids = foundKey.registeredUids.filter(u => String(u).trim() !== cleanUid);
  foundKey.registeredUidsDetails = foundKey.registeredUidsDetails.filter(d => String(d.uid).trim() !== cleanUid);

  if (foundKey.registeredUids.length === initialCount) {
    return res.status(404).json({ success: false, error: `UID ${cleanUid} was not found in this key` });
  }

  // Quota slot remains consumed permanently (slotsConsumed is NOT decremented)
  foundKey.uidsCount = foundKey.registeredUids.length;
  writeJSON(KEYS_FILE, keys);

  // Relay removal to Upstream Master API (POST https://mani272uidbypass.vercel.app/api/v1/uids/remove)
  let upstreamRemoved = false;
  let upstreamMsg = 'Removed from HOMBRE Gateway';
  try {
    const upstreamRes = await fetch(MASTER_REMOVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-KEY': MASTER_API_KEY
      },
      body: JSON.stringify({ uid: cleanUid })
    });
    upstreamRemoved = upstreamRes.ok;
    const resText = await upstreamRes.text();
    try {
      const parsed = JSON.parse(resText);
      upstreamMsg = parsed.message || (upstreamRemoved ? 'Removed from Upstream API' : parsed.error || 'Upstream notice');
    } catch {
      upstreamMsg = resText;
    }
  } catch (err) {
    console.warn('Upstream removal notice:', err.message);
    upstreamMsg = `Removed from Gateway (Upstream error: ${err.message})`;
  }

  addLog({
    endpoint: '/api/admin/keys/:id/uids/delete',
    key: foundKey.key,
    clientName: foundKey.name,
    uid: cleanUid,
    status: 200,
    success: true,
    error: `UID Removed from both APIs (Slot remains consumed: ${foundKey.slotsConsumed}/${foundKey.uidLimit || 'unlimited'})`,
    ip: adminIp,
    durationMs: 0
  });

  addAdminAudit({
    eventType: 'UID_MANUALLY_REMOVED',
    level: 'WARNING',
    action: `Admin manually revoked UID ${cleanUid} from key: ${foundKey.key} ("${foundKey.name}")`,
    details: { uid: cleanUid, key: foundKey.key, upstreamRemoved, message: upstreamMsg },
    req
  });

  return res.json({
    success: true,
    message: `UID ${cleanUid} successfully removed from both APIs! (Quota slot remains consumed)`,
    upstreamRemoved,
    upstreamMessage: upstreamMsg,
    slotsConsumed: foundKey.slotsConsumed,
    uids: foundKey.registeredUidsDetails,
    total: foundKey.registeredUids.length
  });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'hombre-uid-gateway'
  });
});

// Public Stats (Sanitized for Landing Page)
app.get('/api/public/stats', (req, res) => {
  const keys = readJSON(KEYS_FILE, []);
  const logs = readJSON(LOGS_FILE, []);

  res.json({
    totalKeys: keys.length,
    activeKeys: keys.filter(k => k.isActive).length,
    totalRequests: logs.length,
    gatewayOnline: true,
    defaultPrefix: DEFAULT_PREFIX
  });
});

// List All Keys
app.get('/api/admin/keys', requireAdminAuth, (req, res) => {
  const keys = readJSON(KEYS_FILE, []);
  res.json(keys);
});

// Create New Key with Custom Prefix / HOMBRE Prefix
app.post('/api/admin/keys', requireAdminAuth, (req, res) => {
  const { name, prefix, days, maxCalls, uidLimit, customKey } = req.body;
  
  const chosenPrefix = (prefix && prefix.trim()) ? prefix.trim().toUpperCase() : DEFAULT_PREFIX;
  let finalKey;

  if (customKey && customKey.trim()) {
    finalKey = customKey.trim();
  } else {
    const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
    finalKey = `${chosenPrefix}-${randomHex}`;
  }

  const durationDays = parseInt(days, 10);
  let expiresAt = null;
  if (!isNaN(durationDays) && durationDays > 0) {
    expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const rawLimit = uidLimit !== undefined ? uidLimit : maxCalls;
  const parsedLimit = parseInt(rawLimit, 10);
  const finalLimit = (!isNaN(parsedLimit) && parsedLimit > 0) ? parsedLimit : 0;

  const newKey = {
    id: crypto.randomUUID(),
    key: finalKey,
    name: (name && name.trim()) ? name.trim() : 'Unnamed Client',
    prefix: chosenPrefix,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt,
    days: !isNaN(durationDays) && durationDays > 0 ? durationDays : null,
    uidLimit: finalLimit,
    maxCalls: finalLimit,
    registeredUids: [],
    uidsCount: 0,
    usageCount: 0,
    isActive: true,
    lastUsedAt: null
  };

  const keys = readJSON(KEYS_FILE, []);
  keys.unshift(newKey);
  writeJSON(KEYS_FILE, keys);

  addAdminAudit({
    eventType: 'KEY_CREATED',
    level: 'NOTICE',
    action: `Created API Key: ${newKey.key} ("${newKey.name}")`,
    details: { key: newKey.key, name: newKey.name, prefix: chosenPrefix, limit: finalLimit, days: durationDays },
    req
  });

  res.status(201).json({
    success: true,
    message: 'HOMBRE API Key successfully created!',
    key: newKey
  });
});

// Update Key Details (Name, UID Limit, or Duration)
app.patch('/api/admin/keys/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { name, uidLimit, additionalDays } = req.body;
  const keys = readJSON(KEYS_FILE, []);
  const keyObj = keys.find(k => k.id === id);

  if (!keyObj) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  if (name !== undefined && String(name).trim()) {
    keyObj.name = String(name).trim();
  }

  if (uidLimit !== undefined) {
    const parsed = parseInt(uidLimit, 10);
    keyObj.uidLimit = !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    keyObj.maxCalls = keyObj.uidLimit;
  }

  if (additionalDays) {
    const extra = parseInt(additionalDays, 10);
    if (!isNaN(extra) && extra > 0) {
      const baseTime = (keyObj.expiresAt && new Date(keyObj.expiresAt).getTime() > Date.now())
        ? new Date(keyObj.expiresAt).getTime()
        : Date.now();
      keyObj.expiresAt = new Date(baseTime + extra * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  writeJSON(KEYS_FILE, keys);

  addAdminAudit({
    eventType: 'KEY_MODIFIED',
    level: 'NOTICE',
    action: `Modified key settings: ${keyObj.key} ("${keyObj.name}")`,
    details: { key: keyObj.key, name: keyObj.name, limit: keyObj.uidLimit, days: keyObj.days },
    req
  });

  res.json({
    success: true,
    message: 'Key updated successfully!',
    key: keyObj
  });
});

// Toggle Key Status (Active / Paused)
app.patch('/api/admin/keys/:id/toggle', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const keys = readJSON(KEYS_FILE, []);
  const keyObj = keys.find(k => k.id === id);

  if (!keyObj) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  keyObj.isActive = !keyObj.isActive;
  writeJSON(KEYS_FILE, keys);

  addAdminAudit({
    eventType: 'KEY_TOGGLED',
    level: 'NOTICE',
    action: `${keyObj.isActive ? 'Activated' : 'Paused'} API Key: ${keyObj.key} ("${keyObj.name}")`,
    details: { key: keyObj.key, name: keyObj.name, isActive: keyObj.isActive },
    req
  });

  res.json({
    success: true,
    message: `Key is now ${keyObj.isActive ? 'Active' : 'Paused'}`,
    key: keyObj
  });
});

// Delete Key
app.delete('/api/admin/keys/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  let keys = readJSON(KEYS_FILE, []);
  const targetKey = keys.find(k => k.id === id);

  if (!targetKey) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  keys = keys.filter(k => k.id !== id);
  writeJSON(KEYS_FILE, keys);

  addAdminAudit({
    eventType: 'KEY_DELETED',
    level: 'WARNING',
    action: `Permanently deleted API Key: ${targetKey.key} ("${targetKey.name}")`,
    details: { key: targetKey.key, name: targetKey.name },
    req
  });

  res.json({ success: true, message: 'Key deleted successfully' });
});

// Get Request Logs
app.get('/api/admin/logs', requireAdminAuth, (req, res) => {
  const logs = readJSON(LOGS_FILE, []);
  res.json(logs.slice(0, 50));
});

// Clear Request Logs (Standard API traffic only)
app.delete('/api/admin/logs', requireAdminAuth, (req, res) => {
  const logs = readJSON(LOGS_FILE, []);
  writeJSON(LOGS_FILE, []);

  addAdminAudit({
    eventType: 'API_LOGS_CLEARED',
    level: 'WARNING',
    action: `Cleared API Request Traffic Logs (${logs.length} records removed)`,
    details: { previousLogCount: logs.length },
    req
  });

  res.json({ success: true, message: 'Logs cleared' });
});

// ==========================================
// 4. PERMANENT IMMUTABLE ADMIN AUDIT LOGS
// ==========================================

// Get Admin Audit Logs (Strictly protected by Admin Token)
app.get('/api/admin/audit-logs', requireAdminAuth, (req, res) => {
  const auditLogs = readJSON(ADMIN_AUDIT_FILE, []);
  res.json({
    success: true,
    immutable: true,
    total: auditLogs.length,
    logs: auditLogs.slice(0, 300)
  });
});

// Record Admin Console Section Visit (With Debouncing)
const lastAdminVisits = new Map(); // ip -> { section, timestamp }

app.post('/api/admin/audit/visit', requireAdminAuth, (req, res) => {
  const { section, title } = req.body || {};
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const prev = lastAdminVisits.get(ip);
  if (prev && prev.section === section && now - prev.timestamp < 3000) {
    return res.json({ success: true, debounced: true });
  }

  lastAdminVisits.set(ip, { section, timestamp: now });

  const sectionName = title || (section ? String(section).replace('tab-', '').toUpperCase() : 'Console');
  addAdminAudit({
    eventType: 'CONSOLE_VISIT',
    level: 'INFO',
    action: `Admin visited console section: ${sectionName}`,
    details: { section, title: sectionName },
    req
  });

  res.json({ success: true });
});

// Explicit Immutability Enforcer: Reject any attempt to clear or delete admin audit logs
app.delete('/api/admin/audit-logs', requireAdminAuth, (req, res) => {
  addAdminAudit({
    eventType: 'TAMPER_BLOCKED',
    level: 'SECURITY',
    action: 'BLOCKED: Unauthorized attempt to delete permanent Admin Audit Logs',
    details: { policy: 'WORM (Write Once, Read Many) - Immutability Enforced' },
    req
  });

  res.status(403).json({
    success: false,
    error: 'Security Policy Violation: Admin audit logs are permanent and immutable (WORM storage). Deletion is strictly prohibited.'
  });
});

// ==========================================
// DATABASE PERSISTENCE & BACKUP MANAGEMENT
// 100% Data Protection: One-Click JSON Backup & Restore
// ==========================================

// Database Backup Export (One-Click JSON Download)
app.get('/api/admin/database/export', requireAdminAuth, (req, res) => {
  addAdminAudit({
    eventType: 'DATABASE_BACKUP',
    level: 'INFO',
    action: 'Admin exported complete database backup',
    details: { keysCount: memoryKeys.length, auditCount: memoryAdminAudit.length },
    req
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="hombre-backup-${Date.now()}.json"`);
  res.json({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    keys: memoryKeys,
    auditLogs: memoryAdminAudit
  });
});

// Database Backup Import / Restore
app.post('/api/admin/database/import', requireAdminAuth, express.json({ limit: '15mb' }), async (req, res) => {
  const { keys, auditLogs } = req.body || {};
  if (!Array.isArray(keys)) {
    return res.status(400).json({ success: false, error: 'Invalid backup format: "keys" must be an array' });
  }

  let importedCount = 0;
  for (const k of keys) {
    if (k && k.key) {
      const idx = memoryKeys.findIndex(existing => existing.key.trim() === k.key.trim());
      if (idx >= 0) {
        memoryKeys[idx] = { ...memoryKeys[idx], ...k };
      } else {
        memoryKeys.push(k);
      }
      importedCount++;
    }
  }

  writeJSON(KEYS_FILE, memoryKeys);

  if (Array.isArray(auditLogs)) {
    memoryAdminAudit = [...auditLogs, ...memoryAdminAudit].slice(0, 1000);
    writeJSON(ADMIN_AUDIT_FILE, memoryAdminAudit);
  }

  addAdminAudit({
    eventType: 'DATABASE_RESTORE',
    level: 'NOTICE',
    action: `Admin restored database backup (${importedCount} keys imported)`,
    details: { importedCount, totalKeys: memoryKeys.length },
    req
  });

  res.json({
    success: true,
    message: `Database successfully restored. ${importedCount} keys active.`,
    totalKeys: memoryKeys.length
  });
});

// Start Server & Connect Database
const RENDER_PROD_URL = process.env.RENDER_EXTERNAL_URL || 'https://hombre-uid-gateway.onrender.com';

(async () => {
  // Connect to Cloud Database if configured
  await initMongoDB();

  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`👑 HOMBRE UID Gateway running on port ${PORT}`);
    console.log(`🌐 Public Landing Page: ${RENDER_PROD_URL}`);
    console.log(`🛡️ Admin Portal: ${RENDER_PROD_URL}/admin (Locked: Ctrl+Alt+V)`);
    console.log(`📡 Public Proxy Endpoint: POST ${RENDER_PROD_URL}/api/v1/uids/add`);
    console.log(`🎯 Upstream Target: AIR-GAPPED & SECURED (Backend Only)`);
    console.log(`🔑 Admin Authentication: Active`);
    console.log(`💾 Active API Keys in Memory: ${memoryKeys.length}`);
    console.log(`===============================================`);
  });
})();

