# Settings Persistence Issue Analysis

## Problem Description
Settings were being deleted on page reload, even though they should be persisted to the server.

## Root Cause

The issue was in `src/utils/fileStorage.js`, which is a custom Zustand storage adapter that:
1. Uses localStorage as a fast synchronous cache
2. Persists data to JSON files on the backend via API
3. Syncs between localStorage and server

### The Bug
The `fileStorage.js` was reading the auth token directly from localStorage:
```javascript
const raw = localStorage.getItem('auth-storage')
if (!raw) return null
return JSON.parse(raw)?.state?.token ?? null
```

This approach had several problems:
1. **Race condition**: localStorage might not be populated yet when fileStorage initializes
2. **Inconsistency**: The token in localStorage might be stale or corrupted
3. **No store synchronization**: Changes to the auth token in the Zustand store weren't reflected in fileStorage

### Impact
- When settings were cleared via the "Reset All Data" button in SettingsPanel
- They were removed from localStorage
- On page reload, fileStorage tried to fetch from server without proper auth
- Server returned 401 Unauthorized
- Fetch failed silently
- Settings never reappear (lost forever)

## Solution

Changed `fileStorage.js` to read the token from the Zustand store directly:

```javascript
import { getTokenFromStore } from '../store/authStore'

function authHeaders() {
  const token = getTokenFromStore()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

### Benefits
1. **Always current**: Gets token from the actual store state
2. **No race conditions**: Store is properly initialized before use
3. **Consistent**: Uses the same token that the auth store manages
4. **Graceful degradation**: If no token, requests go without auth (server handles this)

## Files Modified

1. **src/store/authStore.js**
   - Added `getTokenFromStore()` function to read token from store

2. **src/utils/fileStorage.js**
   - Imported `getTokenFromStore` from authStore
   - Updated `authHeaders()` to use `getTokenFromStore()`
   - Updated all fetch calls to use the new authHeaders function

## Testing

The fix ensures that:
- Settings persist correctly when user is logged in
- Settings are fetched from server on reload (if available)
- Settings remain in localStorage cache even if server is unreachable
- No unauthorized requests are made when user is not logged in

## Notes

- The auth token itself is stored in 'auth-storage' localStorage key (separate from other stores)
- The "Reset All Data" button only clears the storage keys listed in `ALL_STORAGE_KEYS`
- Auth token survives the reset, allowing settings to be fetched from server on next login
