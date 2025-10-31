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

Add the PlayerSync script to your page:

```html
<script src="https://your-hosting.com/player-sync.js" async defer></script>
```

### 2. Add Player Placeholders

Add `<div>` elements with the class `custom-yt-player` and configure via data attributes:

```html
<div class="custom-yt-player"
     data-video-id="7mz73uXD9DA"
     data-start-time="1011"
     data-end-time="2041">
</div>
```

### 3. That's It!

PlayerSync will automatically:
- Discover all placeholder divs
- Inject the necessary HTML and controls
- Initialize each player independently
- Load the YouTube API once (even for multiple players)

## Files

- **player-sync.js**: The main self-contained script (refactored and optimized)
- **test.html**: Local testing environment with multiple test cases
- **instructions.md**: Detailed deployment guide for Google Cloud Platform
- **README.md**: This file

## Usage Examples

### Full Video Playback

```html
<div class="custom-yt-player" data-video-id="YOUR_VIDEO_ID"></div>
```

### Play with Start Time Only

```html
<div class="custom-yt-player" 
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="60"></div>
```

### Play a Specific Segment

```html
<div class="custom-yt-player" 
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="1011"
     data-end-time="2041"></div>
```

### Multiple Players

```html
<div class="custom-yt-player" 
     data-video-id="VIDEO_1"
     data-start-time="0"
     data-end-time="60"></div>

<div class="custom-yt-player" 
     data-video-id="VIDEO_2"
     data-start-time="300"
     data-end-time="600"></div>

<div class="custom-yt-player" data-video-id="VIDEO_3"></div>

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
- **Help Menu**: Information about controls, keyboard shortcuts, and captions

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

## Deployment

See `instructions.md` for detailed instructions on deploying to Google Cloud Storage and using on platforms like Kajabi.

## Browser Support

Tested and working on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Notes

- Uses vanilla JavaScript (no jQuery or other frameworks)
- Inline CSS for maximum compatibility
- Scoped event handlers prevent conflicts between players
- Console logging for debugging
- Graceful error handling

## Version

**v1.4** - Latest release
- Added help menu with detailed controls information
- Removed settings button
- Added scrollable help menu
- Updated speed increments to 0.1× steps
- Expanded speed range to 0.1× - 3.0×
- Improved keyboard shortcuts documentation
- Better UI organization

