/*
 * PlayerSync - A self-contained, reusable YouTube video player
 * Supports multiple instances per page with segment playback
 * Version: 2.4 (refactored and streamlined)
 */

(function(window) {
    'use strict';

    console.log('PlayerSync: Initializing...');

    var API_SCRIPT_URL = 'https://www.youtube.com/iframe_api';
    var PLAYER_PLACEHOLDER_CLASS = 'custom-yt-player';
    var UPDATE_INTERVAL = 500;
    var END_TIME_CHECK_INTERVAL = 300;
    var players = [];
    var apiReady = false;

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
        this.instanceId = 'player-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        this.segmentDuration = this.endTime ? (this.endTime - this.startTime) : null;
        this.init();
    }

    PlayerSync.prototype.init = function() {
        if (!this.validateConfig()) return;
        this.injectHTML();
        if (!this.setupElements()) return;
        if (apiReady) this.createPlayer();
    };

    PlayerSync.prototype.validateConfig = function() {
        if (!this.videoId) {
            console.error('PlayerSync: videoId required');
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
        var id = this.instanceId;
        var html = [
            '<div id="' + id + '-container" style="max-width: 800px; margin: 20px auto; background: #111; border-radius: 8px; overflow: hidden; border: 1px solid #333;">',
                '<div class="player-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; background-color: #000;">',
                    '<div id="' + id + '-player" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">',
                        '<p style="color: #555; text-align: center; padding-top: 20%;">Loading video...</p>',
                    '</div>',
                '</div>',
                '<div class="custom-controls" style="display: flex; align-items: center; padding: 8px 10px; background-color: #282828; color: #fff; width: 100%; box-sizing: border-box; flex-wrap: wrap; position: relative; z-index: 3;">',
                    '<button class="play-pause" title="Play/Pause" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 0; margin: 0 4px; line-height: 1; width: 35px; text-align: center;">▶</button>',
                    '<button class="back10" title="Back 10 seconds" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⏮</button>',
                    '<button class="forward10" title="Forward 10 seconds" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⏭</button>',
                    '<input class="progress-bar" type="range" min="0" max="100" value="0" title="Seek" style="flex-grow: 1; margin: 0 10px; cursor: pointer; height: 8px; min-width: 80px; vertical-align: middle;" />',
                    '<span class="time-display" style="font-size: 0.9em; margin: 0 5px; font-family: monospace; white-space: nowrap; color: #ccc; min-width: 80px; text-align: center;">',
                        '<span class="current-time">0:00</span> / <span class="duration">0:00</span>',
                    '</span>',
                    '<span class="speed-controls" style="display: inline-flex; align-items: center; background-color: rgba(255,255,255,0.05); border-radius: 4px; padding: 0 3px; margin: 0 5px;">',
                        '<button class="slower" title="Slow down" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px; margin: 0 1px; line-height: 1;">🐢</button>',
                        '<span class="playback-rate" title="Playback speed" style="font-size: 0.85em; padding: 0 5px; min-width: 40px; text-align: center; color: #eee;">1.0×</span>',
                        '<button class="faster" title="Speed up" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px; margin: 0 1px; line-height: 1;">🐇</button>',
                    '</span>',
                    '<button class="fullscreen-button" title="Toggle fullscreen" style="background: none; border: none; color: #eee; font-size: 1.4em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">⛶</button>',
                    '<button class="info-button" title="Help" style="background: none; border: none; color: #eee; font-size: 1.2em; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1; font-weight: bold;">ⓘ</button>',
                '</div>',
                '<div id="' + id + '-error" style="color: red; padding: 10px; text-align: center; display: none; background: #333;"></div>',
            '</div>'
        ].join('');
        this.placeholder.innerHTML = html;
    };

    PlayerSync.prototype.setupElements = function() {
        var id = this.instanceId;
        this.container = document.getElementById(id + '-container');
        this.playerDiv = document.getElementById(id + '-player');
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
        this.errorDiv = document.getElementById(id + '-error');
        this.controlsDiv = this.container.querySelector('.custom-controls');
        this.helpMenuOpen = false;

        if (!this.playerDiv || !this.playPauseBtn || !this.progressBar || !this.currentTimeEl || !this.durationEl || !this.controlsDiv) {
            console.error('PlayerSync: Essential elements not found');
            return false;
        }
        return true;
    };

    PlayerSync.prototype.showError = function(msg) {
        console.error('PlayerSync ERROR:', msg);
        if (this.errorDiv) {
            this.errorDiv.textContent = msg;
            this.errorDiv.style.display = 'block';
        }
        if (this.controlsDiv) this.controlsDiv.style.display = 'none';
    };

    PlayerSync.prototype.createPlayer = function() {
        console.log('PlayerSync: Creating player for video:', this.videoId, 'start:', this.startTime + 's');
        if (this.playerDiv) this.playerDiv.innerHTML = '';

        var playerVars = {
            start: this.startTime,
            playsinline: 1, controls: 0, modestbranding: 1, rel: 0, fs: 1, showinfo: 0, enablejsapi: 1,
            iv_load_policy: 3, cc_load_policy: 0
        };

        try {
            this.player = new window.YT.Player(this.instanceId + '-player', {
                videoId: this.videoId,
                playerVars: playerVars,
                events: {
                    onReady: this.onPlayerReady.bind(this),
                    onStateChange: this.onPlayerStateChange.bind(this),
                    onError: this.onPlayerError.bind(this)
                },
                host: 'https://www.youtube.com'
            });
        } catch (error) {
            console.error('PlayerSync: Error creating player:', error);
            this.showError('Failed to create player: ' + (error.message || 'Unknown error'));
        }
    };

    PlayerSync.prototype.onPlayerReady = function() {
        console.log('PlayerSync: Player ready');
        this.playerReady = true;
        if (this.errorDiv) this.errorDiv.style.display = 'none';
        this.updateDurationDisplay();
        this.attachListeners();
        this.updatePlaybackRateDisplay();
        this.updateProgressBarDisplay();
        this.hideProgressBarPseudoElements();
        this.startIntervals();
    };

    PlayerSync.prototype.onPlayerError = function(e) {
        this.playerReady = false;
        this.clearIntervals();
        var errorMsg = 'Unknown Error (' + e.data + ')';
        switch (e.data) {
            case 2: errorMsg = 'Invalid video ID'; break;
            case 5: errorMsg = 'HTML5 player error'; break;
            case 100: errorMsg = 'Video not found'; break;
            case 101: case 150: errorMsg = 'Video not allowed'; break;
            case 153: errorMsg = 'Invalid configuration'; break;
        }
        this.showError(errorMsg);
    };

    PlayerSync.prototype.onPlayerStateChange = function(e) {
        if (!this.playerReady && e.data !== window.YT.PlayerState.CUED) return;
        if (this.playPauseBtn) {
            if (e.data === window.YT.PlayerState.PLAYING) {
                this.playPauseBtn.textContent = '⏸';
                this.startIntervals();
                this.monitorEndTime();
            } else {
                this.playPauseBtn.textContent = '▶';
                this.clearIntervals();
                if (e.data === window.YT.PlayerState.ENDED && this.endTime !== null) {
                    this.player.seekTo(this.endTime, true);
                    this.updateProgressBarDisplay();
                }
            }
        }
        this.updateProgressBarDisplay();
    };

    PlayerSync.prototype.attachListeners = function() {
        var self = this;
        if (this.playPauseBtn) this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        if (this.back10Btn) this.back10Btn.addEventListener('click', () => this.seek(-10));
        if (this.forward10Btn) this.forward10Btn.addEventListener('click', () => this.seek(10));
        if (this.slowerBtn) this.slowerBtn.addEventListener('click', () => this.changePlaybackRate(-0.1));
        if (this.fasterBtn) this.fasterBtn.addEventListener('click', () => this.changePlaybackRate(0.1));
        if (this.infoButton) this.infoButton.addEventListener('click', () => this.toggleHelpMenu());
        if (this.fullscreenBtn) this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => this.handleProgressBarInput(e));
            this.progressBar.addEventListener('mousedown', () => this.clearIntervals());
            this.progressBar.addEventListener('touchstart', () => this.clearIntervals(), { passive: true });
            this.progressBar.addEventListener('mouseup', () => this.handleProgressBarEnd());
            this.progressBar.addEventListener('touchend', () => this.handleProgressBarEnd());
        }
        document.addEventListener('click', function(e) {
            if (self.helpMenuOpen && self.helpMenu && !self.helpMenu.contains(e.target) && !self.infoButton.contains(e.target)) {
                self.closeHelpMenu();
            }
        });
    };

    PlayerSync.prototype.togglePlayPause = function() {
        if (!this.playerReady || !this.player.getPlayerState) return;
        var state = this.player.getPlayerState();
        var currentTime = this.player.getCurrentTime() || this.startTime;
        if (state === window.YT.PlayerState.PLAYING) {
            this.player.pauseVideo();
        } else {
            if (this.endTime !== null && currentTime >= this.endTime - 0.1) {
                this.player.seekTo(this.startTime, true);
                this.updateProgressBarDisplay();
            }
            this.player.playVideo();
        }
    };

    PlayerSync.prototype.seek = function(amount) {
        if (!this.playerReady || !this.player.getCurrentTime || !this.player.seekTo) return;
        var currentTime = this.player.getCurrentTime() || this.startTime;
        var targetTime = currentTime + amount;
        if (this.startTime !== 0) targetTime = Math.max(this.startTime, targetTime);
        if (this.endTime !== null) targetTime = Math.min(this.endTime, targetTime);
        this.player.seekTo(targetTime, true);
        this.updateProgressBarDisplay();
    };

    PlayerSync.prototype.handleProgressBarInput = function(e) {
        if (!this.playerReady || !this.segmentDuration || !this.progressBar) return;
        var seekToPercent = e.target.value;
        var timeOffset = (seekToPercent / 100) * this.segmentDuration;
        var displayTime = this.startTime + timeOffset;
        if (this.currentTimeEl) {
            var timeInSegment = Math.max(0, displayTime - this.startTime);
            this.currentTimeEl.textContent = this.formatTime(timeInSegment);
        }
    };

    PlayerSync.prototype.handleProgressBarEnd = function() {
        this.seekFromProgress();
        this.startIntervals();
    };

    PlayerSync.prototype.seekFromProgress = function() {
        if (!this.playerReady || !this.player.seekTo || !this.segmentDuration || !this.progressBar) return;
        var seekToPercent = this.progressBar.value;
        var timeOffset = (seekToPercent / 100) * this.segmentDuration;
        var seekToTime = this.endTime !== null ? Math.max(this.startTime, Math.min(this.endTime, this.startTime + timeOffset)) : this.startTime + timeOffset;
        this.player.seekTo(seekToTime, true);
    };

    PlayerSync.prototype.changePlaybackRate = function(change) {
        if (!this.playerReady || !this.player.setPlaybackRate || !this.player.getPlaybackRate) return;
        var currentRate = this.player.getPlaybackRate();
        var newRate = Math.max(0.1, Math.min(3.0, currentRate + change));
        this.player.setPlaybackRate(newRate);
        this.currentPlaybackRate = newRate;
        this.updatePlaybackRateDisplay();
    };

    PlayerSync.prototype.updatePlaybackRateDisplay = function() {
        if (this.playbackRateEl) {
            var display = this.currentPlaybackRate % 1 === 0 ? this.currentPlaybackRate.toFixed(0) + '×' : this.currentPlaybackRate.toFixed(1) + '×';
            this.playbackRateEl.textContent = display;
        }
    };

    PlayerSync.prototype.monitorEndTime = function() {
        if (!this.playerReady || this.endTime === null || !this.player.getCurrentTime || !this.player.getPlayerState) return;
        var currentTime = this.player.getCurrentTime();
        if (currentTime >= this.endTime - 0.2 && this.player.getPlayerState() === window.YT.PlayerState.PLAYING) {
            this.player.pauseVideo();
            if (Math.abs(currentTime - this.endTime) > 0.1) this.player.seekTo(this.endTime, true);
            this.updateProgressBarDisplay();
        }
    };

    PlayerSync.prototype.updateProgressBarDisplay = function() {
        if (!this.playerReady || !this.player.getCurrentTime || !this.progressBar) return;
        var currentTime = this.player.getCurrentTime() || this.startTime;
        var timeInSegment = Math.max(0, currentTime - this.startTime);
        var progress = 0;
        if (this.segmentDuration) {
            progress = Math.max(0, Math.min(100, (timeInSegment / this.segmentDuration) * 100));
        } else {
            // For videos without end time, calculate based on remaining duration
            var totalDuration = this.player.getDuration ? this.player.getDuration() : 0;
            var remainingDuration = totalDuration - this.startTime;
            if (remainingDuration > 0) {
                progress = Math.max(0, Math.min(100, (timeInSegment / remainingDuration) * 100));
            }
        }
        this.progressBar.value = progress;
        if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(timeInSegment);
    };

    PlayerSync.prototype.updateDurationDisplay = function() {
        if (this.durationEl) {
            var duration = this.segmentDuration;
            if (duration === null && this.player && this.player.getDuration) {
                var fullDuration = this.player.getDuration();
                duration = fullDuration - this.startTime; // Remaining duration after start
            }
            this.durationEl.textContent = this.formatTime(duration || 0);
        }
    };

    PlayerSync.prototype.formatTime = function(time) {
        time = Math.max(0, Math.round(time || 0));
        var minutes = Math.floor(time / 60);
        var seconds = time % 60;
        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    };

    PlayerSync.prototype.toggleFullscreen = function() {
        var iframe = this.player ? this.player.getIframe() : null;
        if (!iframe) return;
        try {
            if (iframe.requestFullscreen) iframe.requestFullscreen();
            else if (iframe.mozRequestFullScreen) iframe.mozRequestFullScreen();
            else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
            else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
        } catch (e) { console.error('Error requesting fullscreen:', e); }
    };

    PlayerSync.prototype.clearIntervals = function() {
        if (this.progressBarInterval) { clearInterval(this.progressBarInterval); this.progressBarInterval = null; }
        if (this.endTimeMonitorInterval) { clearInterval(this.endTimeMonitorInterval); this.endTimeMonitorInterval = null; }
    };

    PlayerSync.prototype.startIntervals = function() {
        this.clearIntervals();
        if (!this.playerReady) return;
        var self = this;
        this.progressBarInterval = setInterval(function() {
            if (self.playerReady && self.player && typeof self.player.getCurrentTime === 'function') {
                self.updateProgressBarDisplay();
            } else {
                self.clearIntervals();
            }
        }, UPDATE_INTERVAL);
        if (this.endTime !== null) {
            this.endTimeMonitorInterval = setInterval(function() { self.monitorEndTime(); }, END_TIME_CHECK_INTERVAL);
        }
    };

    PlayerSync.prototype.hideProgressBarPseudoElements = function() {
        if (!this.progressBar) return;
        var id = 'playersync-progress-bar-fix-' + this.instanceId;
        if (document.getElementById(id)) return;
        var style = document.createElement('style');
        style.id = id;
        style.textContent = '#' + this.instanceId + '-container .progress-bar::before, #' + this.instanceId + '-container .progress-bar::after, #' + this.instanceId + '-container input.progress-bar::before, #' + this.instanceId + '-container input.progress-bar::after { display: none !important; visibility: hidden !important; opacity: 0 !important; content: none !important; height: 0 !important; width: 0 !important; background: none !important; position: absolute !important; }';
        document.head.appendChild(style);
    };

    PlayerSync.prototype.toggleHelpMenu = function(e) {
        if (e) e.stopPropagation();
        if (this.helpMenuOpen) this.closeHelpMenu(); else this.openHelpMenu();
    };

    PlayerSync.prototype.openHelpMenu = function() {
        if (!this.infoButton || !this.container) return;
        if (this.helpMenu) this.helpMenu.remove();
        var menu = document.createElement('div');
        menu.className = 'help-menu';
        menu.id = this.instanceId + '-help-menu';
        var css = 'position: absolute; bottom: 50px; right: 0; background-color: rgba(28,28,28,0.95); border: 1px solid #555; border-radius: 4px; padding: 12px; min-width: 260px; max-width: 320px; max-height: 300px; overflow-y: auto; overflow-x: hidden; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.5);';
        css += '::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #777; }';
        menu.style.cssText = css;
        var html = '';
        html += '<div style="font-size: 15px; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; color: #3ea6ff;">Info</div>';
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Keyboard Shortcuts:</div><div style="color: #ccc;">First, click anywhere on the video to select it. Then, you can use the following keys:</div><ul style="color: #ccc; margin-top: 8px; padding-left: 20px;"><li><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Spacebar</span>: Play or Pause the video.</li><li style="margin-top: 5px;"><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">←</span> / <span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">→</span>: Go backward or forward 5 seconds.</li><li style="margin-top: 5px;"><span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C</span>: Toggle English captions on or off.</li></ul></div>';
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Video Controls:</div><div style="color: #ccc;">Use the controls below the video to play, pause, skip forward or backward, adjust speed, and toggle fullscreen:</div><ul style="color: #ccc; margin-top: 8px; padding-left: 20px;"><li><strong>▶️</strong>: Play or pause the video.</li><li style="margin-top: 5px;"><strong>⏮</strong> / <strong>⏭</strong>: Skip backward or forward 10 seconds.</li><li style="margin-top: 5px;"><strong>🐢</strong> / <strong>🐇</strong>: Decrease or increase playback speed.</li><li style="margin-top: 5px;"><strong>⛶</strong>: Enter or exit fullscreen mode.</li></ul></div>';
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Subtitles / Closed Captioning (English):</div><div style="color: #ccc;">To turn English captions on or off, first click the video area, then press the <span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C</span> key on your keyboard. For other languages, please view the video on YouTube.com.</div></div>';
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Audio Tracks (English / Hindi):</div><div style="color: #ccc;">This video is available in both English and Hindi. To switch languages, please open the video on YouTube.com, change the audio track there, and then reload this page to apply your choice.</div></div>';
        menu.innerHTML = html;
        this.container.style.position = 'relative';
        this.container.appendChild(menu);
        this.helpMenu = menu;
        this.helpMenuOpen = true;
    };

    PlayerSync.prototype.closeHelpMenu = function() {
        if (this.helpMenu) this.helpMenu.remove();
        this.helpMenu = null;
        this.helpMenuOpen = false;
    };

    function loadYouTubeAPI() {
        if (window.PlayerSync_API_LOADING || (window.YT && window.YT.Player)) {
            if (window.YT && window.YT.Player) onYouTubeIframeAPIReady();
            return;
        }
        window.PlayerSync_API_LOADING = true;
        var tag = document.createElement('script');
        tag.src = API_SCRIPT_URL;
        tag.onerror = function() { window.PlayerSync_API_LOADING = false; };
        var firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            window.PlayerSync_API_LOADING = false;
        }
    }

    window.onYouTubeIframeAPIReady = function() {
        apiReady = true;
        window.PlayerSync_API_LOADING = false;
        for (var i = 0; i < players.length; i++) players[i].createPlayer();
    };

    function initializePlayers() {
        var placeholders = document.getElementsByClassName(PLAYER_PLACEHOLDER_CLASS);
        if (placeholders.length === 0) return;
        for (var i = 0; i < placeholders.length; i++) {
            var ph = placeholders[i];
            var config = {
                videoId: ph.getAttribute('data-video-id'),
                startTime: parseInt(ph.getAttribute('data-start-time')) || 0,
                endTime: (function() { var et = ph.getAttribute('data-end-time'); return et ? parseInt(et) : null; })()
            };
            try {
                var p = new PlayerSync(ph, config);
                players.push(p);
            } catch (e) { console.error('PlayerSync: Error creating player:', e); }
        }
        loadYouTubeAPI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlayers);
    } else {
        initializePlayers();
    }

    window.PlayerSync = { players: players, version: '2.4' };

})(window);
