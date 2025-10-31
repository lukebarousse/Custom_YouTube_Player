# PlayerSync Deployment Instructions

This guide will walk you through deploying PlayerSync to Google Cloud Platform (GCP) and using it on your website (e.g., Kajabi).

## Overview

PlayerSync is a self-contained YouTube video player that supports:
- Multiple player instances on the same page
- Segment playback (start and end times)
- Custom controls (play/pause, seek, speed, fullscreen)
- No external dependencies except the YouTube IFrame API

## Part 1: Deploy to Google Cloud Storage

### Step 1: Create a Google Cloud Storage Bucket

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Cloud Storage** → **Buckets**
3. Click **CREATE BUCKET**
4. Configure your bucket:
   - **Name**: `playersync` (or any unique name you prefer)
   - **Location type**: Choose a region close to your users
   - **Default storage class**: Standard
   - **Access control**: Uniform
5. Click **CREATE**

### Step 2: Upload player-sync.js

1. In the bucket you just created, click **UPLOAD FILES**
2. Select your `player-sync.js` file
3. Click **OPEN**
4. Wait for the upload to complete

### Step 3: Make the File Public

1. Click on the uploaded `player-sync.js` file in your bucket
2. Click on the **PERMISSIONS** tab
3. Click **GRANT ACCESS**
4. Configure the permission:
   - **New principals**: Enter `allUsers`
   - **Name**: `allUsers`
   - **Role**: Select **Storage Object Viewer**
5. Click **SAVE**
6. Confirm the action by typing your bucket name when prompted

### Step 4: Get the Public URL

1. The public URL will be in the following format:
   ```
   https://storage.googleapis.com/YOUR-BUCKET-NAME/player-sync.js
   ```

2. For example, if your bucket is named `playersync`:
   ```
   https://storage.googleapis.com/playersync/player-sync.js
   ```

3. Copy this URL—you'll need it for the next section.

## Part 2: Using PlayerSync on Your Website

### Basic Usage

Add the PlayerSync script to your page along with placeholder `<div>` elements for each video player.

### HTML Structure

For each video player you want to display, add a `<div>` with the class `custom-yt-player` and provide configuration via data attributes:

```html
<div class="custom-yt-player"
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="START_SECONDS"
     data-end-time="END_SECONDS">
</div>
```

**Required Attributes:**
- `data-video-id`: Your YouTube video ID (e.g., `7mz73uXD9DA`)

**Optional Attributes:**
- `data-start-time`: Start time in seconds (default: 0)
- `data-end-time`: End time in seconds (default: play to end)

Then, add the PlayerSync script at the bottom of your page:

```html
<script src="https://storage.googleapis.com/YOUR-BUCKET-NAME/player-sync.js" async defer></script>
```

### Complete Example for Kajabi

Here's a complete example you can paste into your Kajabi page:

```html
<div class="custom-yt-player"
     data-video-id="7mz73uXD9DA"
     data-start-time="1011"
     data-end-time="2041">
</div>

<div class="custom-yt-player"
     data-video-id="anotherVideoID_123"
     data-start-time="300"
     data-end-time="950">
</div>

<script src="https://storage.googleapis.com/playersync/player-sync.js" async defer></script>
```

## Part 3: Usage Examples

### Example 1: Full Video Playback

Play an entire video without restrictions:

```html
<div class="custom-yt-player"
     data-video-id="YOUR_VIDEO_ID">
</div>
```

### Example 2: Start at a Specific Time

Start playing from a specific time and continue to the end:

```html
<div class="custom-yt-player"
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="120">
</div>
```

### Example 3: Play a Specific Segment

Play only a specific portion of a video:

```html
<div class="custom-yt-player"
     data-video-id="YOUR_VIDEO_ID"
     data-start-time="60"
     data-end-time="180">
</div>
```

### Example 4: Multiple Players on One Page

You can add multiple players to the same page—they will work independently:

```html
<div class="custom-yt-player"
     data-video-id="VIDEO_ID_1"
     data-start-time="0"
     data-end-time="60">
</div>

<div class="custom-yt-player"
     data-video-id="VIDEO_ID_2"
     data-start-time="100"
     data-end-time="200">
</div>

<div class="custom-yt-player"
     data-video-id="VIDEO_ID_3">
</div>

<script src="https://storage.googleapis.com/playersync/player-sync.js" async defer></script>
```

## Part 4: Player Controls

Each player includes the following controls:

- **▶︎ Play/Pause**: Toggle playback
- **⏮︎ Back 10 seconds**: Rewind by 10 seconds
- **⏭︎ Forward 10 seconds**: Skip ahead by 10 seconds
- **Progress bar**: Drag to seek to any position in the video
- **Time display**: Shows current time and total duration
- **🐢 Slower**: Decrease playback speed (minimum 0.25×)
- **🐇 Faster**: Increase playback speed (maximum 2.0×)
- **⛶ Fullscreen**: Enter fullscreen mode

## Part 5: Troubleshooting

### The video doesn't load

1. Verify your YouTube video ID is correct
2. Check that the video is publicly viewable
3. Ensure the video allows embedding
4. Check the browser console for error messages

### Error 153: Video player configuration error

This error typically occurs when:
- The page is opened via `file://` protocol (must use `http://` or `https://`)
- Browser extensions are blocking YouTube resources
- Network restrictions are in place

**Solutions:**
- If testing locally, use a local web server (see Part 7: Local Testing)
- Temporarily disable ad blockers or privacy extensions
- Clear browser cache and cookies
- The PlayerSync script automatically sets the referrer policy to resolve this issue

### Multiple API loads

If you see console warnings about the API loading multiple times, ensure you're only including the script tag once on your page.

### Players not appearing

1. Check that your placeholder `<div>` elements have the class `custom-yt-player`
2. Verify that the data attributes are spelled correctly (`data-video-id`, etc.)
3. Ensure the script URL is correct and accessible
4. Check browser console for JavaScript errors

### Invalid configuration error

Make sure:
- `data-start-time` is not negative
- `data-end-time` is greater than `data-start-time` (if both are provided)

## Part 6: Advanced Configuration

### Styling

Players are styled with inline CSS for maximum compatibility. If you need to customize the appearance, you can add additional CSS targeting the player elements:

```html
<style>
  .custom-yt-player [id*="-container"] {
    max-width: 900px !important;
    border: 2px solid #0066cc !important;
  }
</style>
```

### Debugging

PlayerSync logs helpful messages to the browser console. To see them:

1. Open your browser's developer tools (F12 or right-click → Inspect)
2. Go to the Console tab
3. Look for messages starting with "PlayerSync:"

You can also access player instances programmatically:

```javascript
console.log(window.PlayerSync.players);
```

## Part 7: Local Testing

Before deploying to production, test locally using the provided `test.html` file.

### Quick Start (Easiest Method)

1. Navigate to the project folder on your computer
2. Double-click `test.html` to open it in your web browser
3. The test page will automatically load with all player examples

### Using a Local Web Server (Recommended)

For the best testing experience, use a local web server:

**Using Python 3:**
1. Open a terminal/command prompt
2. Navigate to the project folder
3. Run: `python -m http.server 8000`
4. Open your browser to: `http://localhost:8000/test.html`

**Using Node.js:**
1. Open a terminal/command prompt
2. Navigate to the project folder
3. Run: `npx http-server`
4. Open your browser to the URL shown (usually `http://localhost:8080/test.html`)

**Using VS Code:**
1. Install the "Live Server" extension in VS Code
2. Right-click `test.html` in the file explorer
3. Select "Open with Live Server"

### What to Verify

1. ✅ All players load successfully
2. ✅ Play/pause controls work
3. ✅ Seek bar updates correctly
4. ✅ Back/forward buttons work
5. ✅ Speed controls function properly
6. ✅ Multiple players work independently
7. ✅ Error handling displays for invalid video IDs
8. ✅ Check browser console (F12) for any errors
9. ✅ Test on different browsers and devices

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your configuration matches the examples above
3. Ensure your YouTube video ID is valid and the video is publicly accessible

## License

This script is provided as-is for use in your projects.

