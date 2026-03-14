const BASE = 'https://yt.lemnoslife.com/noKey'

/** Extract playlistId from a YouTube playlist URL */
function parsePlaylistId(url) {
  try {
    const u = new URL(url)
    return u.searchParams.get('list') || null
  } catch {
    return null
  }
}

/** Parse ISO 8601 duration (PT5M30S) → minutes (rounded up) */
function parseDuration(iso) {
  if (!iso) return 10
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 10
  const h = parseInt(m[1] || '0')
  const min = parseInt(m[2] || '0')
  const sec = parseInt(m[3] || '0')
  return Math.max(1, h * 60 + min + Math.ceil(sec / 60))
}

/** Returns true if the URL is a YouTube playlist */
export function isYouTubePlaylist(url) {
  try {
    const u = new URL(url)
    return (
      (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) &&
      u.searchParams.has('list')
    )
  } catch {
    return false
  }
}

/**
 * Fetch all videos in a YouTube playlist via yt.lemnoslife.com.
 * Returns Array<{ title: string, durationMins: number }>
 * Throws an Error with a human-readable message on failure.
 */
export async function fetchYouTubePlaylist(url) {
  const playlistId = parsePlaylistId(url)
  if (!playlistId) throw new Error('Not a valid YouTube playlist URL (missing list= parameter)')

  // ── Step 1: collect video IDs + titles (up to 150 items / 3 pages) ────────
  const videoItems = []
  let pageToken = null

  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${BASE}/playlistItems?${params}`)
    if (!res.ok) throw new Error(`YouTube playlist fetch failed (HTTP ${res.status})`)

    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'YouTube API error')

    for (const item of data.items || []) {
      const videoId = item.snippet?.resourceId?.videoId
      const title = item.snippet?.title
      if (videoId && title && title !== 'Deleted video' && title !== 'Private video') {
        videoItems.push({ videoId, title })
      }
    }

    pageToken = data.nextPageToken || null
    if (!pageToken) break
  }

  if (videoItems.length === 0) throw new Error('No public videos found in this playlist')

  // ── Step 2: fetch durations in batches of 50 ─────────────────────────────
  const results = []

  for (let i = 0; i < videoItems.length; i += 50) {
    const batch = videoItems.slice(i, i + 50)
    const ids = batch.map((v) => v.videoId).join(',')

    const res = await fetch(`${BASE}/videos?part=contentDetails&id=${ids}`)
    if (!res.ok) throw new Error(`YouTube video details fetch failed (HTTP ${res.status})`)

    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'YouTube API error')

    const detailMap = {}
    for (const item of data.items || []) {
      detailMap[item.id] = item.contentDetails?.duration || 'PT10M'
    }

    for (const v of batch) {
      results.push({
        title: v.title,
        durationMins: parseDuration(detailMap[v.videoId] || 'PT10M'),
      })
    }
  }

  return results
}
