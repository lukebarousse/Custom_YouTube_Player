/*
 * PlayerSync - A self-contained, reusable YouTube video player
 * Supports multiple instances per page with segment playback
 * Version: 1.5
 */

(function(window) {
    'use strict';

    console.log('PlayerSync: Initializing...');

    // Configuration
    var API_SCRIPT_URL = 'https://www.youtube.com/iframe_api';
    var PLAYER_PLACEHOLDER_CLASS = 'custom-yt-player';
    var UPDATE_INTERVAL = 500;
    var END_TIME_CHECK_INTERVAL = 300;
    var END_TIME_PADDING = 0.2;

    // Track all player instances
    var players = [];
    var apiReady = false;

    // Player class to manage a single video player instance
    function PlayerSync(placeholder, config) {
        this.placeholder = placeholder;
        this.videoId = config.videoId;
        this.startTime = config.startTime || 0;
        this.endTime = config.endTime || null;
        this.player = null;
        this.currentPlaybackRate = 1.0;
        this.progressBarInterval = null;
        this.endTimeMonitorInterval = null;
        this.playerReady = false;

        // Create a unique ID for this player instance
        this.instanceId = 'player-instance-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Container and elements
        this.container = null;
        this.playerDiv = null;
        this.playPauseBtn = null;
        this.backBtn = null;
        this.forwardBtn = null;
        this.progressBar = null;
        this.currentTimeEl = null;
        this.durationEl = null;
        this.slowerBtn = null;
        this.fasterBtn = null;
        this.playbackRateEl = null;
        this.fullscreenBtn = null;
        this.errorDiv = null;
        this.controlsDiv = null;

        // Calculate segment duration
        this.segmentDuration = this.endTime ? (this.endTime - this.startTime) : null;

        // Bind methods to this instance
        this.togglePlayPause = this.togglePlayPause.bind(this);
        this.seekAdjust = this.seekAdjust.bind(this);
        this.handleProgressBarInput = this.handleProgressBarInput.bind(this);
        this.handleProgressBarEnd = this.handleProgressBarEnd.bind(this);
        this.changePlaybackRate = this.changePlaybackRate.bind(this);
        this.toggleFullscreen = this.toggleFullscreen.bind(this);
        this.clearIntervals = this.clearIntervals.bind(this);
        this.startIntervals = this.startIntervals.bind(this);
        this.toggleHelpMenu = this.toggleHelpMenu.bind(this);
        this.openHelpMenu = this.openHelpMenu.bind(this);
        this.closeHelpMenu = this.closeHelpMenu.bind(this);

        // Initialize this player
        this.init();
    }

    PlayerSync.prototype.init = function() {
        // Validate configuration
        if (!this.validateConfig()) {
            return;
        }

        // Inject HTML structure
        this.injectHTML();

        // Get references to elements
        if (!this.setupElements()) {
            return;
        }

        // Wait for API to be ready
        if (apiReady) {
            this.createPlayer();
        }
    };

    PlayerSync.prototype.validateConfig = function() {
        if (!this.videoId) {
            console.error('PlayerSync: videoId is required');
            return false;
        }

        if (this.startTime < 0) {
            console.error('PlayerSync: startTime cannot be negative');
            return false;
        }

        if (this.endTime !== null && this.endTime <= this.startTime) {
            console.error('PlayerSync: endTime must be greater than startTime');
            return false;
        }

        return true;
    };

    PlayerSync.prototype.injectHTML = function() {
        var html = [
            '<div id="' + this.instanceId + '-container" style="max-width: 800px; margin: 20px auto; background: #111; border-radius: 8px; overflow: hidden; border: 1px solid #333;">',
                '<div class="player-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; background-color: #000;">',
                    '<div id="' + this.instanceId + '-player" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">',
                        '<p style="color: #555; text-align: center; padding-top: 20%;">Loading video...</p>',
                    '</div>',
                '</div>',
                '<div class="custom-controls" style="display: flex; align-items: center; padding: 8px 10px; background-color: #282828; color: #fff; width: 100%; box-sizing: border-box; flex-wrap: wrap; position: relative; z-index: 3;">',
                    '<button class="play-pause" title="Play/Pause" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 0; margin: 0 4px; line-height: 1; width: 35px; text-align: center;">▶︎</button>',
                    '<button class="back10" title="Back 10 seconds" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⏮︎</button>',
                    '<button class="forward10" title="Forward 10 seconds" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⏭︎</button>',
                    '<input class="progress-bar" type="range" min="0" max="100" value="0" title="Seek" style="flex-grow: 1; margin: 0 10px; cursor: pointer; height: 8px; min-width: 80px; vertical-align: middle; position: relative; z-index: 1;" />',
                    '<span class="time-display" style="font-size: 0.9em; margin: 0 5px; font-family: monospace; white-space: nowrap; color: #ccc; min-width: 80px; text-align: center;">',
                        '<span class="current-time">0:00</span> / <span class="duration">0:00</span>',
                    '</span>',
                    '<span class="speed-controls" style="display: inline-flex; align-items: center; background-color: rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 0 3px; margin: 0 5px;">',
                        '<button class="slower" title="Slow down" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px; margin: 0 1px; line-height: 1;">🐢</button>',
                        '<span class="playback-rate" title="Playback speed" style="font-size: 0.85em; padding: 0 5px; min-width: 40px; text-align: center; color: #eee;">1.0×</span>',
                        '<button class="faster" title="Speed up" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px; margin: 0 1px; line-height: 1;">🐇</button>',
                    '</span>',
                    '<button class="fullscreen-button" title="Toggle fullscreen" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⛶︎</button>',
                    '<button class="info-button" title="Help" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1; font-weight: bold;">ⓘ</button>',
                '</div>',
                '<div id="' + this.instanceId + '-error" style="color: red; padding: 10px; text-align: center; display: none; background: #333;"></div>',
            '</div>'
        ].join('');

        this.placeholder.innerHTML = html;
    };

    PlayerSync.prototype.setupElements = function() {
        this.container = document.getElementById(this.instanceId + '-container');
        if (!this.container) {
            console.error('PlayerSync: Container not found');
            return false;
        }

        this.playerDiv = this.container.querySelector('#' + this.instanceId + '-player');
        this.playPauseBtn = this.container.querySelector('.play-pause');
        this.back10Btn = this.container.querySelector('.back10');
        this.forward10Btn = this.container.querySelector('.forward10');
        this.progressBar = this.container.querySelector('.progress-bar');
        this.currentTimeEl = this.container.querySelector('.current-time');
        this.durationEl = this.container.querySelector('.duration');
        this.slowerBtn = this.container.querySelector('.slower');
        this.fasterBtn = this.container.querySelector('.faster');
        this.playbackRateEl = this.container.querySelector('.playback-rate');
        this.fullscreenBtn = this.container.querySelector('.fullscreen-button');
        this.infoButton = this.container.querySelector('.info-button');
        this.errorDiv = this.container.querySelector('#' + this.instanceId + '-error');
        this.controlsDiv = this.container.querySelector('.custom-controls');
        
        // Help menu state
        this.helpMenuOpen = false;

        if (!this.playerDiv || !this.playPauseBtn || !this.progressBar || 
            !this.currentTimeEl || !this.durationEl || !this.controlsDiv) {
            console.error('PlayerSync: Essential control elements not found');
            this.showError('Player UI elements missing.');
            return false;
        }

        return true;
    };

    PlayerSync.prototype.showError = function(message) {
        console.error('PlayerSync ERROR:', message);
        if (this.errorDiv) {
            this.errorDiv.textContent = 'Video Player Error: ' + message;
            this.errorDiv.style.display = 'block';
        }
        if (this.controlsDiv) {
            this.controlsDiv.style.display = 'none';
        }
    };

    PlayerSync.prototype.createPlayer = function() {
        if (!apiReady) {
            console.warn('PlayerSync: API not ready');
            return;
        }

        if (this.player) {
            console.warn('PlayerSync: Player already exists');
            return;
        }

        console.log('PlayerSync: Creating player for video: ' + this.videoId + ', start: ' + this.startTime + 's');

        try {
            if (this.playerDiv) {
                this.playerDiv.innerHTML = '';
            }

            var playerVars = {
                'start': this.startTime,
                'playsinline': 1,
                'controls': 0,
                'modestbranding': 1,
                'rel': 0,
                'fs': 1,
                'showinfo': 0,
                'enablejsapi': 1,
                'iv_load_policy': 3,
                'cc_load_policy': 0,
                'disablekb': 1
            };

            // Note: We don't set 'end' in playerVars because YouTube API
            // doesn't support it. We handle end time via JavaScript monitoring.

            this.player = new window.YT.Player(this.instanceId + '-player', {
                videoId: this.videoId,
                playerVars: playerVars,
                events: {
                    'onReady': this.onPlayerReady.bind(this),
                    'onStateChange': this.onPlayerStateChange.bind(this),
                    'onError': this.onPlayerError.bind(this)
                },
                host: 'https://www.youtube.com'
            });

            // Set referrer policy on the iframe to fix Error 153
            var self = this;
            setTimeout(function() {
                try {
                    var iframe = self.player ? self.player.getIframe() : null;
                    if (iframe && iframe.setAttribute) {
                        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                        console.log('PlayerSync: Set referrer policy on iframe');
                        
                        // Get container reference first
                        var container = document.getElementById(self.instanceId + '-container');
                        
                        // Inject CSS to hide YouTube's native UI overlays and pseudo-elements
                        var hideYTStyle = document.createElement('style');
                        hideYTStyle.id = 'playersync-hide-overlays-' + self.instanceId;
                        hideYTStyle.textContent = 
                            '#' + self.instanceId + '-container::before, ' +
                            '#' + self.instanceId + '-container::after, ' +
                            '#' + self.instanceId + '-player::before, ' +
                            '#' + self.instanceId + '-player::after, ' +
                            '#' + self.instanceId + '-player iframe::before, ' +
                            '#' + self.instanceId + '-player iframe::after, ' +
                            '.player-wrapper::before, .player-wrapper::after, ' +
                            '#' + self.instanceId + '-container .progress-bar::before, ' +
                            '#' + self.instanceId + '-container .progress-bar::after, ' +
                            '#' + self.instanceId + '-container input[type="range"]::before, ' +
                            '#' + self.instanceId + '-container input[type="range"]::after, ' +
                            '#' + self.instanceId + '-container input.progress-bar::before, ' +
                            '#' + self.instanceId + '-container input.progress-bar::after { display: none !important; visibility: hidden !important; opacity: 0 !important; content: none !important; height: 0 !important; width: 0 !important; background: none !important; } ' +
                            '#' + self.instanceId + '-player iframe { pointer-events: auto !important; }';
                        document.head.appendChild(hideYTStyle);
                        
                        // Ensure container hides overflow to clip any YouTube UI
                        if (container) {
                            container.style.overflow = 'hidden';
                            container.style.position = 'relative';
                        }
                    }
                } catch (e) {
                    console.warn('PlayerSync: Could not set referrer policy or hide overlays:', e);
                }
            }, 500);

            console.log('PlayerSync: YT.Player object created');
        } catch (e) {
            this.showError('Failed to create player: ' + e.message);
            console.error(e);
        }
    };

    PlayerSync.prototype.onPlayerReady = function(event) {
        console.log('PlayerSync: Player ready');
        this.playerReady = true;
        if (this.errorDiv) {
            this.errorDiv.style.display = 'none';
        }

        this.updateDurationDisplay();
        this.attachListeners();
        this.updatePlaybackRateDisplay();
        this.updateProgressBarDisplay();
        this.hideProgressBarPseudoElements();
        this.startIntervals();
    };

    PlayerSync.prototype.onPlayerError = function(event) {
        this.playerReady = false;
        this.clearIntervals();

        var errorMsg = 'Unknown Error (' + event.data + ')';
        switch (event.data) {
            case 2:
                errorMsg = 'Invalid video ID';
                break;
            case 5:
                errorMsg = 'HTML5 player error';
                break;
            case 100:
                errorMsg = 'Video not found';
                break;
            case 101:
            case 150:
                errorMsg = 'Video not allowed for playback';
                break;
            case 153:
                errorMsg = 'End time exceeds video length or invalid configuration';
                break;
        }

        this.showError(errorMsg);
    };

    PlayerSync.prototype.onPlayerStateChange = function(event) {
        if (!this.playerReady && event.data !== window.YT.PlayerState.CUED) {
            return;
        }

        console.log('PlayerSync: State changed to: ' + event.data);

        if (this.playPauseBtn) {
            if (event.data === window.YT.PlayerState.PLAYING) {
                this.playPauseBtn.textContent = '⏸︎';
                this.startIntervals();
                this.monitorEndTime();
            } else {
                this.playPauseBtn.textContent = '▶︎';
                this.clearIntervals();
                
                if (event.data === window.YT.PlayerState.ENDED && this.endTime !== null) {
                    this.player.seekTo(this.endTime, true);
                    this.updateProgressBarDisplay();
                }
            }
        }

        this.updateProgressBarDisplay();
    };

    PlayerSync.prototype.attachListeners = function() {
        console.log('PlayerSync: Attaching control listeners');

        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', this.togglePlayPause);
        }
        if (this.back10Btn) {
            this.back10Btn.addEventListener('click', this.seek.bind(this, -10));
        }
        if (this.forward10Btn) {
            this.forward10Btn.addEventListener('click', this.seek.bind(this, 10));
        }
        if (this.slowerBtn) {
            this.slowerBtn.addEventListener('click', function() {
                this.changePlaybackRate(-0.1);
            }.bind(this));
        }
        if (this.fasterBtn) {
            this.fasterBtn.addEventListener('click', function() {
                this.changePlaybackRate(0.1);
            }.bind(this));
        }
        if (this.infoButton) {
            this.infoButton.addEventListener('click', this.toggleHelpMenu.bind(this));
        }
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', this.toggleFullscreen);
        }
        if (this.progressBar) {
            this.progressBar.addEventListener('input', this.handleProgressBarInput);
            this.progressBar.addEventListener('mousedown', this.clearIntervals);
            this.progressBar.addEventListener('touchstart', this.clearIntervals, { passive: true });
            this.progressBar.addEventListener('mouseup', this.handleProgressBarEnd);
            this.progressBar.addEventListener('touchend', this.handleProgressBarEnd);
        }
        
        // Close menus when clicking outside
        document.addEventListener('click', function(event) {
            if (this.helpMenuOpen && this.helpMenu) {
                if (!this.helpMenu.contains(event.target) && 
                    !this.infoButton.contains(event.target)) {
                    this.closeHelpMenu();
                }
            }
        }.bind(this));
    };

    PlayerSync.prototype.togglePlayPause = function() {
        if (!this.playerReady || !this.player.getPlayerState) {
            return;
        }

        try {
            var state = this.player.getPlayerState();
            var currentTime = this.player.getCurrentTime() || this.startTime;

            if (state === window.YT.PlayerState.PLAYING) {
                this.player.pauseVideo();
            } else {
                // If past end time, restart from startTime
                if (this.endTime !== null && currentTime >= this.endTime - 0.1) {
                    console.log('PlayerSync: Reached end, restarting from beginning');
                    this.player.seekTo(this.startTime, true);
                    this.updateProgressBarDisplay();
                }
                this.player.playVideo();
            }
        } catch (e) {
            console.error('Error toggling play/pause', e);
        }
    };

    PlayerSync.prototype.seek = function(amount) {
        if (!this.playerReady || !this.player.getCurrentTime || !this.player.seekTo) {
            return;
        }

        try {
            var currentTime = this.player.getCurrentTime() || this.startTime;
            var targetTime = currentTime + amount;

            // Clamp within segment boundaries
            var seekToTime = targetTime;
            if (this.startTime !== 0) {
                seekToTime = Math.max(this.startTime, seekToTime);
            }
            if (this.endTime !== null) {
                seekToTime = Math.min(this.endTime, seekToTime);
            }

            this.player.seekTo(seekToTime, true);
            this.updateProgressBarDisplay();
        } catch (e) {
            console.error('Error seeking:', e);
        }
    };

    PlayerSync.prototype.seekAdjust = function(amount) {
        this.seek(amount);
    };

    PlayerSync.prototype.handleProgressBarInput = function(event) {
        if (!this.playerReady) {
            return;
        }

        try {
            var seekToPercent = event.target.value;
            
            if (this.segmentDuration !== null) {
                var timeOffset = (seekToPercent / 100) * this.segmentDuration;
                var displayTime = this.startTime + timeOffset;
                this.updateCurrentTimeDisplay(displayTime);
            } else {
                // If no end time, use current video duration
                var duration = this.player.getDuration();
                if (duration) {
                    var displayTime = (seekToPercent / 100) * duration;
                    this.updateCurrentTimeDisplay(displayTime);
                }
            }
        } catch (e) {
            console.error('Error handling progress bar input:', e);
        }
    };

    PlayerSync.prototype.handleProgressBarEnd = function() {
        if (!this.playerReady || !this.player.seekTo || !this.progressBar) {
            return;
        }

        try {
            var seekToPercent = this.progressBar.value;
            
            if (this.segmentDuration !== null) {
                var timeOffset = (seekToPercent / 100) * this.segmentDuration;
                var seekToTime = Math.max(this.startTime, Math.min(this.endTime, this.startTime + timeOffset));
            } else {
                var duration = this.player.getDuration();
                var seekToTime = (seekToPercent / 100) * duration;
            }

            this.player.seekTo(seekToTime, true);
        } catch (e) {
            console.error('Error seeking from progress bar:', e);
        }
    };

    PlayerSync.prototype.changePlaybackRate = function(change) {
        if (!this.playerReady || !this.player.setPlaybackRate || !this.player.getPlaybackRate) {
            return;
        }

        try {
            var currentRate = this.player.getPlaybackRate();
            var newRate = Math.max(0.1, Math.min(3.0, currentRate + change));
            this.player.setPlaybackRate(newRate);
            this.currentPlaybackRate = newRate;
            this.updatePlaybackRateDisplay();
        } catch (e) {
            console.error('Error changing playback rate:', e);
        }
    };

    PlayerSync.prototype.updatePlaybackRateDisplay = function() {
        if (this.playbackRateEl) {
            var display = this.currentPlaybackRate % 1 === 0 
                ? this.currentPlaybackRate.toFixed(0) 
                : this.currentPlaybackRate.toFixed(1);
            this.playbackRateEl.textContent = display + '×';
        }
    };

    PlayerSync.prototype.hideProgressBarPseudoElements = function() {
        if (!this.progressBar) {
            return;
        }
        
        // Apply inline styles directly to hide pseudo-elements
        var style = document.createElement('style');
        style.id = 'playersync-progress-bar-fix-' + this.instanceId;
        style.textContent = 
            '#' + this.instanceId + '-container .progress-bar::before, ' +
            '#' + this.instanceId + '-container .progress-bar::after, ' +
            '#' + this.instanceId + '-container input.progress-bar::before, ' +
            '#' + this.instanceId + '-container input.progress-bar::after { ' +
            '    display: none !important; ' +
            '    visibility: hidden !important; ' +
            '    opacity: 0 !important; ' +
            '    content: none !important; ' +
            '    height: 0 !important; ' +
            '    width: 0 !important; ' +
            '    background: none !important; ' +
            '    position: absolute !important; ' +
            '}';
        document.head.appendChild(style);
    };

    PlayerSync.prototype.monitorEndTime = function() {
        if (!this.playerReady || !this.player.getCurrentTime || !this.player.getPlayerState) {
            return;
        }

        if (this.endTime === null) {
            return;
        }

        try {
            var currentTime = this.player.getCurrentTime();

            if (currentTime >= this.endTime - END_TIME_PADDING) {
                if (this.player.getPlayerState() === window.YT.PlayerState.PLAYING) {
                    console.log('PlayerSync: Reached end time. Pausing.');
                    this.player.pauseVideo();

                    if (Math.abs(currentTime - this.endTime) > 0.1) {
                        this.player.seekTo(this.endTime, true);
                    }

                    this.updateProgressBarDisplay();
                }
            }
        } catch (e) {
            console.error('Error monitoring end time:', e);
        }
    };

    PlayerSync.prototype.updateProgressBarDisplay = function() {
        if (!this.playerReady || !this.player.getCurrentTime || !this.progressBar) {
            return;
        }

        try {
            var currentTime = this.player.getCurrentTime() || this.startTime;

            var progress = 0;
            if (this.segmentDuration !== null) {
                var timeInSegment = Math.max(0, currentTime - this.startTime);
                progress = Math.max(0, Math.min(100, (timeInSegment / this.segmentDuration) * 100));
            } else {
                var duration = this.player.getDuration();
                if (duration) {
                    progress = (currentTime / duration) * 100;
                }
            }

            this.progressBar.value = progress;
            this.updateCurrentTimeDisplay(currentTime);
        } catch (e) {
            console.error('Error updating progress display:', e);
        }
    };

    PlayerSync.prototype.updateCurrentTimeDisplay = function(absoluteTime) {
        if (this.currentTimeEl) {
            var timeInSegment = Math.max(0, absoluteTime - this.startTime);
            this.currentTimeEl.textContent = this.formatTime(timeInSegment);
        }
    };

    PlayerSync.prototype.updateDurationDisplay = function() {
        if (this.durationEl) {
            var duration = this.segmentDuration;
            if (duration === null && this.player && this.player.getDuration) {
                duration = this.player.getDuration();
            }
            this.durationEl.textContent = this.formatTime(duration || 0);
        }
    };

    PlayerSync.prototype.formatTime = function(timeInSeconds) {
        timeInSeconds = Math.max(0, Math.round(timeInSeconds || 0));
        var minutes = Math.floor(timeInSeconds / 60);
        var seconds = timeInSeconds % 60;
        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    };

    PlayerSync.prototype.toggleFullscreen = function() {
        console.log('PlayerSync: Fullscreen button clicked');
        var iframe = this.player ? this.player.getIframe() : null;
        if (!iframe) {
            return;
        }

        try {
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen();
            } else if (iframe.mozRequestFullScreen) {
                iframe.mozRequestFullScreen();
            } else if (iframe.webkitRequestFullscreen) {
                iframe.webkitRequestFullscreen();
            } else if (iframe.msRequestFullscreen) {
                iframe.msRequestFullscreen();
            }
        } catch (e) {
            console.error('Error requesting fullscreen:', e);
        }
    };

    PlayerSync.prototype.toggleHelpMenu = function(event) {
        event.stopPropagation();
        
        if (this.helpMenuOpen) {
            this.closeHelpMenu();
        } else {
            this.openHelpMenu();
        }
    };

    PlayerSync.prototype.openHelpMenu = function() {
        if (!this.infoButton || !this.container) {
            return;
        }

        // Remove existing menu if present
        if (this.helpMenu) {
            this.helpMenu.remove();
        }

        // Create help menu
        var menu = document.createElement('div');
        menu.className = 'help-menu';
        menu.id = this.instanceId + '-help-menu';
        menu.style.cssText = [
            'position: absolute',
            'bottom: 50px',
            'right: 0',
            'background-color: rgba(28, 28, 28, 0.95)',
            'border: 1px solid #555',
            'border-radius: 4px',
            'padding: 12px',
            'min-width: 260px',
            'max-width: 320px',
            'max-height: 300px',
            'overflow-y: auto',
            'overflow-x: hidden',
            'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5)',
            'z-index: 100',
            'font-size: 13px',
            'color: #fff',
            'line-height: 1.6'
        ].join('; ');
        
        // Add custom scrollbar styling
        var style = document.createElement('style');
        style.textContent = `
            #${this.instanceId}-help-menu::-webkit-scrollbar {
                width: 8px;
            }
            #${this.instanceId}-help-menu::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
            }
            #${this.instanceId}-help-menu::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }
            #${this.instanceId}-help-menu::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        document.head.appendChild(style);

        var html = '';
        html += '<div style="font-size: 15px; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px;">Help</div>';

        // --- Keyboard Shortcuts Section ---
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;">';
        html += '<div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Keyboard Shortcuts:</div>';
        html += '<div style="color: #ccc;">First, click anywhere on the video to select it. Then, you can use the following keys:</div>';
        html += '<ul style="color: #ccc; margin-top: 8px; padding-left: 20px;">';
        html += '<li><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Spacebar</span>: Play or Pause the video.</li>';
        html += '<li style="margin-top: 5px;"><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">←</span> / <span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">→</span>: Go backward or forward 5 seconds.</li>';
        html += '<li style="margin-top: 5px;"><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C</span>: Toggle English captions on or off.</li>';
        html += '</ul>';
        html += '</div>';

        // --- Video Controls Section ---
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;">';
        html += '<div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Video Controls:</div>';
        html += '<div style="color: #ccc;">Use the controls below the video to play, pause, skip forward or backward, adjust speed, and toggle fullscreen:</div>';
        html += '<ul style="color: #ccc; margin-top: 8px; padding-left: 20px;">';
        html += '<li><strong>▶️</strong>: Play or pause the video.</li>';
        html += '<li style="margin-top: 5px;"><strong>⏮</strong> / <strong>⏭</strong>: Skip backward or forward 10 seconds.</li>';
        html += '<li style="margin-top: 5px;"><strong>🐢</strong> / <strong>🐇</strong>: Decrease or increase playback speed.</li>';
        html += '<li style="margin-top: 5px;"><strong>⛶</strong>: Enter or exit fullscreen mode.</li>';
        html += '</ul>';
        html += '</div>';
        
        // --- Subtitles Section ---
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;">';
        html += '<div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Subtitles / Closed Captioning (English):</div>';
        html += '<div style="color: #ccc;">To turn English captions on or off, first click the video area, then press the <span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C</span> key on your keyboard. For other languages, please view the video on YouTube.com.</div>';
        html += '</div>';
        
        // --- Audio Tracks Section ---
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;">';
        html += '<div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Audio Tracks (English / Hindi):</div>';
        html += '<div style="color: #ccc;">This video is available in both English and Hindi. To switch languages, please open the video on YouTube.com, change the audio track there, and then reload this page to apply your choice.</div>';
        html += '</div>';
        


        menu.innerHTML = html;

        // Position the menu relative to the info button
        this.container.style.position = 'relative';
        this.container.appendChild(menu);
        this.helpMenu = menu;
        this.helpMenuOpen = true;
    };

    PlayerSync.prototype.closeHelpMenu = function() {
        if (this.helpMenu) {
            this.helpMenu.remove();
            this.helpMenu = null;
        }
        this.helpMenuOpen = false;
    };

    PlayerSync.prototype.clearIntervals = function() {
        if (this.progressBarInterval) {
            clearInterval(this.progressBarInterval);
            this.progressBarInterval = null;
        }
        if (this.endTimeMonitorInterval) {
            clearInterval(this.endTimeMonitorInterval);
            this.endTimeMonitorInterval = null;
        }
    };

    PlayerSync.prototype.startIntervals = function() {
        this.clearIntervals();

        if (!this.playerReady) {
            return;
        }

        var self = this;

        this.progressBarInterval = setInterval(function() {
            if (self.playerReady && self.player && typeof self.player.getCurrentTime === 'function') {
                self.updateProgressBarDisplay();
            } else {
                console.warn('PlayerSync: Stopping progress interval');
                self.clearIntervals();
            }
        }, UPDATE_INTERVAL);

        if (this.endTime !== null) {
            this.endTimeMonitorInterval = setInterval(function() {
                self.monitorEndTime();
            }, END_TIME_CHECK_INTERVAL);
        }
    };

    // Load YouTube API if not already loaded
    function loadYouTubeAPI() {
        console.log('PlayerSync: Checking for YouTube API...');

        if (window.PlayerSync_API_LOADING || window.YT && window.YT.Player) {
            console.log('PlayerSync: API already loading or loaded');
            if (window.YT && window.YT.Player) {
                onYouTubeIframeAPIReady();
            }
            return;
        }

        window.PlayerSync_API_LOADING = true;

        var tag = document.createElement('script');
        tag.src = API_SCRIPT_URL;
        tag.onerror = function() {
            window.PlayerSync_API_LOADING = false;
            console.error('PlayerSync: Failed to load YouTube API');
            showGlobalError('Failed to load the YouTube API script.');
        };

        var firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            console.log('PlayerSync: YouTube API script tag inserted');
        } else {
            window.PlayerSync_API_LOADING = false;
            console.error('PlayerSync: Could not find script tag to insert API');
            showGlobalError('Setup error: Cannot insert YouTube API script.');
        }
    }

    // Show global error if needed
    function showGlobalError(message) {
        console.error('PlayerSync GLOBAL ERROR:', message);
        var errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ff4444; color: white; padding: 10px; text-align: center; z-index: 9999;';
        errorDiv.textContent = 'PlayerSync Error: ' + message;
        document.body.appendChild(errorDiv);
    }

    // Global callback when YouTube API is ready
    window.onYouTubeIframeAPIReady = function() {
        console.log('PlayerSync: YouTube API Ready callback executed');
        apiReady = true;
        window.PlayerSync_API_LOADING = false;

        // Create all pending players
        for (var i = 0; i < players.length; i++) {
            players[i].createPlayer();
        }
    };

    // Initialize all players on page load
    function initializePlayers() {
        console.log('PlayerSync: Scanning for player placeholders...');

        var placeholders = document.getElementsByClassName(PLAYER_PLACEHOLDER_CLASS);
        console.log('PlayerSync: Found ' + placeholders.length + ' player placeholder(s)');

        if (placeholders.length === 0) {
            console.warn('PlayerSync: No player placeholders found on page');
            return;
        }

        // Create a player for each placeholder
        for (var i = 0; i < placeholders.length; i++) {
            var placeholder = placeholders[i];
            var config = {
                videoId: placeholder.getAttribute('data-video-id'),
                startTime: parseInt(placeholder.getAttribute('data-start-time')) || 0,
                endTime: (function() {
                    var endTimeAttr = placeholder.getAttribute('data-end-time');
                    return endTimeAttr ? parseInt(endTimeAttr) : null;
                })()
            };

            console.log('PlayerSync: Creating player instance', i + 1, config);

            try {
                var player = new PlayerSync(placeholder, config);
                players.push(player);
            } catch (e) {
                console.error('PlayerSync: Error creating player instance:', e);
            }
        }

        // Load YouTube API
        loadYouTubeAPI();
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlayers);
    } else {
        initializePlayers();
    }

    // Export for debugging
    window.PlayerSync = {
        players: players,
        version: '1.5'
    };

})(window);

