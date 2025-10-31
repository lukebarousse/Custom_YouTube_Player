# PlayerSync

A self-contained, reusable YouTube video player that supports multiple instances per page with segment playback capabilities.

## Features

- 🎬 Multiple player instances on a single page
- ⏱️ Segment playback with custom start and end times
- 🎮 Custom controls (play/pause, seek, speed, fullscreen, help menu)
- 📱 Responsive design with inline styling
- 🚀 Zero external dependencies (except YouTube IFrame API)
- 🔧 Self-contained: just load and use
- ⌨️ Keyboard shortcuts support
- 📚 Built-in help menu

## Quick Start

### 1. Include the Script

Add the PlayerSync script to your page (host it on your preferred CDN or web server):

```html
<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

**Note:** After deploying the script to your hosting (see Deployment section), replace `your-hosting.com` with your actual script URL.

### 2. Add Player Placeholders

Add `<div>` elements with the class `custom-yt-player` and configure via data attributes:

```html
<div class="custom-yt-player"
     data-video-id="7mz73uXD9DA"
     data-start-time="1011"
     data-end-time="2041">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER PLACEHOLDER<br/>Video: YOUR_VIDEO_ID<br/>Start: 1011s | End: 2041s</p>
</div>
```

**Note:** The placeholder content inside the div will be automatically replaced with the video player when the page loads. You can customize the placeholder text as needed for your Kajabi editor.

### 3. That's It!

PlayerSync will automatically:
- Discover all placeholder divs
- Inject the necessary HTML and controls
- Initialize each player independently
- Load the YouTube API once (even for multiple players)

## Files

- **player-sync.js**: The main self-contained script (v1.6)
- **test.html**: Local testing environment with multiple test cases
- **upload.sh**: Upload script for Google Cloud Storage
- **DEPLOY.md**: Deployment guide
- **README.md**: This file

## Usage Examples

### Full Video Playback

Play an entire video from start to finish:

```html
<div class="custom-yt-player" data-video-id="YOUR_VIDEO_ID">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER<br/>Video: YOUR_VIDEO_ID</p>
</div>

<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

### Play with Start Time Only

Start playing from a specific time and continue to the end:

```html
<div class="custom-yt-player" 
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="60">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER<br/>Video: YOUR_VIDEO_ID | Starts: 60s</p>
</div>

<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

### Play a Specific Segment

Play only a specific portion of a video:

```html
<div class="custom-yt-player" 
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="60"
     data-end-time="180">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER<br/>Video: YOUR_VIDEO_ID<br/>Start: 60s | End: 180s</p>
</div>

<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

### Multiple Players on One Page

Add multiple players to the same page—they work independently:

```html
<!-- Video 1: Play full video -->
<div class="custom-yt-player" data-video-id="VIDEO_ID_1">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER 1<br/>Video: VIDEO_ID_1</p>
</div>

<!-- Video 2: Play a segment -->
<div class="custom-yt-player"
     data-video-id="VIDEO_ID_2"
     data-start-time="60"
     data-end-time="180">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER 2<br/>Video: VIDEO_ID_2 | 60s-180s</p>
</div>

<!-- Video 3: Another full video -->
<div class="custom-yt-player" data-video-id="VIDEO_ID_3">
    <p style="padding: 40px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc; color: #666; font-family: monospace; margin: 0;">🎬 VIDEO PLAYER 3<br/>Video: VIDEO_ID_3</p>
</div>

<!-- Load PlayerSync script once for all players -->
<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

## Configuration

### Required Attributes

- `data-video-id`: YouTube video ID (e.g., `7mz73uXD9DA`)

### Optional Attributes

- `data-start-time`: Start time in seconds (default: 0)
- `data-end-time`: End time in seconds (default: play to end)

## Features

### Player Controls

Each player includes:
- **Play/Pause**: Toggle playback
- **Back 10 seconds**: Rewind by 10 seconds
- **Forward 10 seconds**: Skip ahead by 10 seconds
- **Progress bar**: Drag to seek
- **Time display**: Current time and duration
- **Playback speed**: 0.1× to 3.0× (increments of 0.1×)
- **Fullscreen**: Toggle fullscreen mode
- **Help Menu (ⓘ)**: Scrollable menu with keyboard shortcuts, video controls, subtitles, and audio track information

### Keyboard Shortcuts

When the video is focused:
- **Spacebar**: Play or pause the video
- **Left Arrow (←)**: Skip backward 5 seconds
- **Right Arrow (→)**: Skip forward 5 seconds
- **C**: Toggle English captions on/off

### Smart Features

- Automatic segment boundary monitoring
- Seek clamping within segment boundaries
- Independent operation of multiple players
- Error handling and user feedback
- Optimized API loading (loads once for all players)
- Scrollable help menu with detailed instructions

## Local Testing

### Quick Start

1. Open a terminal/command prompt and navigate to the project folder
2. Start a local web server:
   - **Python:** `python -m http.server 8000`
   - **Node.js:** `npx http-server`
   - **VS Code:** Install "Live Server" extension, right-click `test.html` → "Open with Live Server"
3. Open your browser to the URL shown (usually <a href="http://localhost:8000/test.html" target="_blank">http://localhost:8000/test.html</a>)
4. The test page will load with all player examples

**Note:** You must use a local web server. Opening files directly (file:// protocol) will cause Error 153.

### What to Test

The test page includes:
- Multiple player scenarios
- Error handling with invalid video IDs
- Configuration validation
- Independent operation of multiple players
- Console logs for debugging

## Troubleshooting

### Error 153: Video player configuration error

This error occurs when opening files directly from your file system (file:// protocol). YouTube requires files to be served via HTTP/HTTPS.

**Solution:** Always use a local web server when testing. See the "Local Testing" section above for instructions.

### Video doesn't load

1. Verify your YouTube video ID is correct
2. Check that the video is publicly viewable
3. Ensure the video allows embedding
4. Check the browser console for error messages

### Players not appearing

1. Check that your placeholder `<div>` elements have the class `custom-yt-player`
2. Verify that the data attributes are spelled correctly (`data-video-id`, etc.)
3. Ensure the script URL is correct and accessible
4. Check browser console for JavaScript errors

### Invalid configuration error

Make sure:
- `data-start-time` is not negative
- `data-end-time` is greater than `data-start-time` (if both are provided)

## Deployment

Deploy the `player-sync.js` file to your preferred hosting (Google Cloud Storage, AWS S3, CDN, etc.).

After deployment, update the script URL in your HTML to point to your hosted file.

## Advanced

### Custom Styling

Players use inline CSS for maximum compatibility. To customize appearance:

```html
<style>
  .custom-yt-player [id*="-container"] {
    max-width: 900px !important;
    border: 2px solid #0066cc !important;
  }
</style>
```

### Debugging

PlayerSync logs helpful messages to the browser console. Open developer tools (F12) and look for messages starting with "PlayerSync:".

Access player instances programmatically:
```javascript
console.log(window.PlayerSync.players);
```

## Notes

- Uses vanilla JavaScript (no jQuery or other frameworks)
- Inline CSS for maximum compatibility
- Scoped event handlers prevent conflicts between players
- Console logging for debugging
- Graceful error handling