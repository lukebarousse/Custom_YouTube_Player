/*
 * PlayerSync - A self-contained, reusable YouTube video player
 * Supports multiple instances per page with segment playback
 * Version: 3.1 (expand button works on iPhone: CSS fullscreen where the browser has none)
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
    var RATE_KEY = 'playerSync.playbackRate';

    // The chosen speed is kept per browser, so it follows the student from
    // lesson to lesson. Storage can be blocked (private mode), so never throw.
    function loadSavedRate() {
        try {
            var rate = parseFloat(window.localStorage.getItem(RATE_KEY));
            if (isNaN(rate)) return null;
            return Math.round(Math.max(0.1, Math.min(3.0, rate)) * 10) / 10;
        } catch (e) {
            return null;
        }
    }

    function saveRate(rate) {
        try {
            window.localStorage.setItem(RATE_KEY, String(rate));
        } catch (e) {}
    }

    // Captions follow the student across lessons too. Off by default.
    var CC_KEY = 'playerSync.captions';

    function loadSavedCaptions() {
        try { return window.localStorage.getItem(CC_KEY) === 'on'; } catch (e) { return false; }
    }

    function saveCaptions(on) {
        try { window.localStorage.setItem(CC_KEY, on ? 'on' : 'off'); } catch (e) {}
    }


    // Line icons in the bar's color (currentColor), so they match the other controls.
    function svg(body) {
        return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">' + body + '</svg>';
    }
    var SPEAKER = '<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4z" fill="currentColor" stroke="none"/>';
    var ICONS = {
        volHigh: svg(SPEAKER + '<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
        volLow: svg(SPEAKER + '<path d="M15.5 9a4 4 0 0 1 0 6"/>'),
        volMuted: svg(SPEAKER + '<path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
        // Expand: arrows out to the top-left and bottom-right corners.
        fsEnter: svg('<path d="M10 10L4.5 4.5M4.5 9.5v-5h5"/><path d="M14 14l5.5 5.5M19.5 14.5v5h-5"/>'),
        // Exit: the same arrows pointing back in.
        fsExit: svg('<path d="M4.5 4.5L10 10M5 10h5V5"/><path d="M19.5 19.5L14 14M19 14h-5v5"/>')
    };

    function PlayerSync(placeholder, config) {
        this.placeholder = placeholder;
        this.videoId = config.videoId;
        this.startTime = config.startTime || 0;
        this.endTime = config.endTime || null;
        this.player = null;
        this.currentPlaybackRate = loadSavedRate() || 1.0;
        this.captionsOn = loadSavedCaptions();
        this.captionsApplied = false;
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
                    '<span class="volume-controls" style="display: inline-flex; align-items: center; margin: 0 2px;">',
                        '<button class="volume-button" title="Mute (M)" style="background: none; border: none; color: #eee; cursor: pointer; padding: 5px 6px; margin: 0; line-height: 1;">' + ICONS.volHigh + '</button>',
                        '<input class="volume-slider" type="range" min="0" max="100" value="100" title="Volume" style="width: 0; opacity: 0; margin: 0; padding: 0; cursor: pointer; height: 6px; vertical-align: middle; transition: width 0.15s, opacity 0.15s, margin 0.15s;" />',
                    '</span>',
                    '<button class="cc-button" title="Captions (C)" style="background: none; border: 1.5px solid #eee; border-radius: 3px; color: #eee; font-size: 0.75em; font-weight: bold; cursor: pointer; padding: 2px 4px; margin: 0 6px; line-height: 1; font-family: sans-serif;">CC</button>',
                    '<button class="playback-rate" title="Playback speed" style="background: rgba(255,255,255,0.08); border: none; border-radius: 4px; color: #eee; font-size: 0.85em; cursor: pointer; padding: 5px 6px; margin: 0 4px; line-height: 1; min-width: 44px; text-align: center;">1×</button>',
                    '<button class="fullscreen-button" title="Fullscreen (F)" style="background: none; border: none; color: #eee; cursor: pointer; padding: 5px 8px; margin: 0 4px; line-height: 1;">' + ICONS.fsEnter + '</button>',
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
        this.playbackRateEl = this.container.querySelector('.playback-rate');
        this.volumeControls = this.container.querySelector('.volume-controls');
        this.volumeBtn = this.container.querySelector('.volume-button');
        this.volumeSlider = this.container.querySelector('.volume-slider');
        this.ccBtn = this.container.querySelector('.cc-button');
        this.fullscreenBtn = this.container.querySelector('.fullscreen-button');
        this.infoButton = this.container.querySelector('.info-button');
        this.errorDiv = document.getElementById(id + '-error');
        this.controlsDiv = this.container.querySelector('.custom-controls');
        this.wrapper = this.container.querySelector('.player-wrapper');
        this.helpMenuOpen = false;
        this.speedMenu = null;
        this.muted = false;
        this.volume = 100;
        // Kept so fullscreen can be undone exactly.
        this.containerCss = this.container.style.cssText;
        this.wrapperCss = this.wrapper ? this.wrapper.style.cssText : '';

        // Phones and tablets have hardware volume buttons: save the space.
        try {
            if (this.volumeControls && window.matchMedia && window.matchMedia('(hover: none)').matches) {
                this.volumeControls.style.display = 'none';
            }
        } catch (e) {}

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
        this.applyPlaybackRate();
        this.updatePlaybackRateDisplay();
        this.updateProgressBarDisplay();
        this.hideProgressBarPseudoElements();
        try {
            this.muted = this.player.isMuted();
            this.volume = this.player.getVolume();
        } catch (e) {}
        this.updateVolumeDisplay();
        this.updateCaptionsDisplay();
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
                // YouTube can drop a rate set before playback starts; reapply it.
                this.applyPlaybackRate();
                // The captions module only loads once playback starts, and it
                // may switch on from the viewer's YouTube settings. Set our
                // choice on the first play, then once more after it settles.
                if (!this.captionsApplied) {
                    this.captionsApplied = true;
                    var self = this;
                    this.applyCaptions();
                    setTimeout(function() { self.applyCaptions(); }, 1000);
                }
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
        if (this.playbackRateEl) this.playbackRateEl.addEventListener('click', () => this.toggleSpeedMenu());
        if (this.infoButton) this.infoButton.addEventListener('click', () => this.toggleHelpMenu());
        if (this.fullscreenBtn) this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        if (this.ccBtn) this.ccBtn.addEventListener('click', () => this.toggleCaptions());
        if (this.volumeBtn) this.volumeBtn.addEventListener('click', () => this.toggleMute());
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value, 10)));
        }
        if (this.volumeControls) {
            var open = function() { self.showVolumeSlider(true); };
            var close = function() { if (!self.volumeControls.contains(document.activeElement)) self.showVolumeSlider(false); };
            this.volumeControls.addEventListener('mouseenter', open);
            this.volumeControls.addEventListener('mouseleave', close);
            this.volumeControls.addEventListener('focusin', open);
            this.volumeControls.addEventListener('focusout', function() { setTimeout(close, 0); });
        }
        // A clicked button keeps focus, and a later Space would click it again
        // instead of pausing. Hand focus back after each click.
        var buttons = this.controlsDiv.querySelectorAll('button');
        for (var b = 0; b < buttons.length; b++) {
            buttons[b].addEventListener('mouseup', function() { this.blur(); });
        }
        var onFsChange = function() { self.onFullscreenChange(); };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        document.addEventListener('keydown', function(e) { self.onKeyDown(e); });
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
            if (self.speedMenu && !self.speedMenu.contains(e.target) && !self.playbackRateEl.contains(e.target)) {
                self.closeSpeedMenu();
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
        // Build on our own value: getPlaybackRate lags behind quick clicks.
        var currentRate = this.currentPlaybackRate;
        var newRate = Math.round(Math.max(0.1, Math.min(3.0, currentRate + change)) * 10) / 10;
        this.player.setPlaybackRate(newRate);
        this.currentPlaybackRate = newRate;
        saveRate(newRate);
        this.updatePlaybackRateDisplay();
    };

    PlayerSync.prototype.setPlaybackRate = function(rate) {
        this.changePlaybackRate(rate - this.currentPlaybackRate);
    };

    // Speed lives in one button: a small menu with presets plus the old
    // 0.1 steps, so the bar keeps its width with volume and CC added.
    PlayerSync.prototype.toggleSpeedMenu = function() {
        if (this.speedMenu) { this.closeSpeedMenu(); return; }
        this.closeHelpMenu();
        var self = this;
        var menu = document.createElement('div');
        menu.className = 'speed-menu';
        menu.style.cssText = 'position: absolute; bottom: 50px; right: 50px; background-color: rgba(28,28,28,0.97); border: 1px solid #555; border-radius: 4px; padding: 10px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.5); color: #eee; font-family: sans-serif; font-size: 14px;';
        var btn = 'background: rgba(255,255,255,0.08); border: none; border-radius: 3px; color: #eee; cursor: pointer; padding: 5px 8px; margin: 2px; font-size: 13px;';
        var presets = [0.75, 1, 1.25, 1.5, 1.75, 2];
        var html = '<div style="font-weight: bold; color: #3ea6ff; margin-bottom: 8px;">Speed</div>';
        html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">';
        html += '<button data-step="-0.1" title="Slower" style="' + btn + '">−</button>';
        html += '<span class="speed-now" style="min-width: 48px; text-align: center;"></span>';
        html += '<button data-step="0.1" title="Faster" style="' + btn + '">+</button></div>';
        html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr);">';
        for (var i = 0; i < presets.length; i++) {
            html += '<button data-rate="' + presets[i] + '" style="' + btn + '">' + presets[i] + '×</button>';
        }
        html += '</div>';
        menu.innerHTML = html;
        menu.addEventListener('click', function(e) {
            var t = e.target.closest('button');
            if (!t) return;
            if (t.getAttribute('data-step')) self.changePlaybackRate(parseFloat(t.getAttribute('data-step')));
            if (t.getAttribute('data-rate')) self.setPlaybackRate(parseFloat(t.getAttribute('data-rate')));
            self.updateSpeedMenu();
        });
        if (!this.pseudoFs) this.container.style.position = 'relative';
        this.container.appendChild(menu);
        this.speedMenu = menu;
        this.updateSpeedMenu();
    };

    PlayerSync.prototype.updateSpeedMenu = function() {
        if (!this.speedMenu) return;
        var now = this.speedMenu.querySelector('.speed-now');
        if (now && this.playbackRateEl) now.textContent = this.playbackRateEl.textContent;
        var btns = this.speedMenu.querySelectorAll('button[data-rate]');
        for (var i = 0; i < btns.length; i++) {
            var on = parseFloat(btns[i].getAttribute('data-rate')) === this.currentPlaybackRate;
            btns[i].style.background = on ? '#3ea6ff' : 'rgba(255,255,255,0.08)';
            btns[i].style.color = on ? '#111' : '#eee';
        }
    };

    PlayerSync.prototype.closeSpeedMenu = function() {
        if (this.speedMenu) this.speedMenu.remove();
        this.speedMenu = null;
    };

    // ---- Volume
    PlayerSync.prototype.toggleMute = function() {
        if (!this.playerReady || !this.player.mute) return;
        if (this.muted || this.volume === 0) {
            this.player.unMute();
            if (this.volume === 0) { this.volume = 50; this.player.setVolume(50); }
            this.muted = false;
        } else {
            this.player.mute();
            this.muted = true;
        }
        this.updateVolumeDisplay();
    };

    PlayerSync.prototype.setVolume = function(v) {
        if (!this.playerReady || !this.player.setVolume) return;
        v = Math.max(0, Math.min(100, v || 0));
        this.player.setVolume(v);
        this.volume = v;
        if (v > 0 && this.muted) { this.player.unMute(); this.muted = false; }
        this.updateVolumeDisplay();
    };

    PlayerSync.prototype.updateVolumeDisplay = function() {
        var silent = this.muted || this.volume === 0;
        if (this.volumeBtn) {
            this.volumeBtn.innerHTML = silent ? ICONS.volMuted : (this.volume < 50 ? ICONS.volLow : ICONS.volHigh);
            this.volumeBtn.title = silent ? 'Unmute (M)' : 'Mute (M)';
        }
        if (this.volumeSlider) this.volumeSlider.value = silent ? 0 : this.volume;
    };

    PlayerSync.prototype.showVolumeSlider = function(show) {
        if (!this.volumeSlider) return;
        this.volumeSlider.style.width = show ? '70px' : '0';
        this.volumeSlider.style.opacity = show ? '1' : '0';
        this.volumeSlider.style.margin = show ? '0 6px 0 2px' : '0';
    };

    // ---- Captions (English). The player keeps its own on/off state: YouTube's
    // getOption('captions', 'track') still reports the track after captions are
    // turned off (tested 2026-11-13), so it cannot be read back.
    PlayerSync.prototype.applyCaptions = function() {
        if (!this.playerReady || !this.player.loadModule) return;
        var self = this;
        if (this.captionsOn) {
            this.player.loadModule('captions');
            var turnOn = function() { try { self.player.setOption('captions', 'track', { languageCode: 'en' }); } catch (e) {} };
            turnOn();
            setTimeout(turnOn, 400);
        } else {
            try { this.player.unloadModule('captions'); } catch (e) {}
        }
    };

    PlayerSync.prototype.toggleCaptions = function() {
        if (!this.playerReady) return;
        this.captionsOn = !this.captionsOn;
        saveCaptions(this.captionsOn);
        this.applyCaptions();
        this.updateCaptionsDisplay();
    };

    PlayerSync.prototype.updateCaptionsDisplay = function() {
        if (!this.ccBtn) return;
        this.ccBtn.style.background = this.captionsOn ? '#eee' : 'none';
        this.ccBtn.style.color = this.captionsOn ? '#111' : '#eee';
        this.ccBtn.title = this.captionsOn ? 'Captions off (C)' : 'Captions on (C)';
    };

    // ---- Keyboard. Inside the video frame YouTube handles keys itself; these
    // cover the rest of the player (the bar, and fullscreen) so the same keys work.
    PlayerSync.prototype.onKeyDown = function(e) {
        if (!this.playerReady || e.ctrlKey || e.metaKey || e.altKey) return;
        if (this.pseudoFs && e.key === 'Escape') { this.setPseudoFullscreen(false); e.preventDefault(); return; }
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        var inPlayer = this.pseudoFs || fsEl === this.container || this.container.contains(document.activeElement);
        if (!inPlayer) return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' && e.target.type !== 'range') return;
        if (e.target === this.volumeSlider) return;
        // A button reached with Tab keeps its own Space and Enter.
        if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
        var k = e.key;
        if (k === ' ' || k === 'k' || k === 'K') this.togglePlayPause();
        else if (k === 'ArrowLeft') this.seek(-5);
        else if (k === 'ArrowRight') this.seek(5);
        else if (k === 'c' || k === 'C') this.toggleCaptions();
        else if (k === 'm' || k === 'M') this.toggleMute();
        else if (k === 'f' || k === 'F') this.toggleFullscreen();
        else return;
        e.preventDefault();
    };

    PlayerSync.prototype.applyPlaybackRate = function() {
        if (!this.playerReady || !this.player.setPlaybackRate || !this.player.getPlaybackRate) return;
        if (this.player.getPlaybackRate() !== this.currentPlaybackRate) {
            this.player.setPlaybackRate(this.currentPlaybackRate);
        }
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

    // Fullscreen takes the whole player, video and control bar together.
    // Until v3.0 only the video frame went fullscreen, and since the frame has
    // YouTube's own controls turned off, fullscreen had no controls at all.
    PlayerSync.prototype.toggleFullscreen = function() {
        if (this.pseudoFs) { this.setPseudoFullscreen(false); return; }
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        var self = this;
        try {
            if (fsEl) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                return;
            }
            var c = this.container;
            var allowed = document.fullscreenEnabled || document.webkitFullscreenEnabled;
            if (allowed && c.requestFullscreen) {
                var p = c.requestFullscreen();
                if (p && p.catch) p.catch(function() { self.setPseudoFullscreen(true); });
                return;
            }
            if (allowed && c.webkitRequestFullscreen) { c.webkitRequestFullscreen(); return; }
        } catch (e) { console.error('Error requesting fullscreen:', e); }
        // iPhone has no fullscreen for page elements (only for a bare <video>,
        // which the YouTube frame is not). Fill the screen with CSS instead.
        this.setPseudoFullscreen(true);
    };

    // v3.1: "fullscreen" made with CSS, for iPhone. The player is pinned over
    // the whole viewport and the page under it stops scrolling. The frame is
    // not moved in the page, because a moved iframe reloads the video.
    var TOP_Z = '2147483647';
    var TRAPS = ['transform', 'filter', 'perspective', 'backdrop-filter', '-webkit-backdrop-filter', 'contain', 'will-change'];

    PlayerSync.prototype.setPseudoFullscreen = function(on) {
        if (on === !!this.pseudoFs) return;
        this.pseudoFs = on;
        var root = document.documentElement;
        if (on) {
            this.closeSpeedMenu();
            this.closeHelpMenu();
            this.savedScroll = [root.style.overflow, document.body.style.overflow];
            root.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            // A parent with a transform or filter traps position: fixed inside
            // it, and a parent with its own z-index can let the site header
            // cover the player. Turn those off on the parents until exit.
            this.savedAncestors = [];
            for (var el = this.container.parentElement; el && el !== root; el = el.parentElement) {
                var cs = window.getComputedStyle(el);
                var props = [];
                for (var i = 0; i < TRAPS.length; i++) {
                    var v = cs.getPropertyValue(TRAPS[i]);
                    if (v && v !== 'none' && v !== 'auto' && v !== 'normal') props.push([TRAPS[i], TRAPS[i] === 'will-change' ? 'auto' : 'none']);
                }
                if (cs.position !== 'static' && cs.zIndex !== 'auto') props.push(['z-index', TOP_Z]);
                for (var j = 0; j < props.length; j++) {
                    this.savedAncestors.push([el, props[j][0], el.style.getPropertyValue(props[j][0]), el.style.getPropertyPriority(props[j][0])]);
                    el.style.setProperty(props[j][0], props[j][1], 'important');
                }
            }
            this.container.style.cssText = this.containerCss + '; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; height: 100dvh; max-width: none; margin: 0; border: none; border-radius: 0; z-index: ' + TOP_Z + '; display: flex; flex-direction: column; background: #000; box-sizing: border-box; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
            if (this.wrapper) this.wrapper.style.cssText = this.wrapperCss + '; flex: 1 1 auto; height: auto; min-height: 0; padding-bottom: 0;';
        } else {
            this.closeSpeedMenu();
            this.closeHelpMenu();
            root.style.overflow = this.savedScroll ? this.savedScroll[0] : '';
            document.body.style.overflow = this.savedScroll ? this.savedScroll[1] : '';
            var saved = this.savedAncestors || [];
            for (var k = saved.length - 1; k >= 0; k--) {
                saved[k][0].style.setProperty(saved[k][1], saved[k][2], saved[k][3]);
            }
            this.savedAncestors = null;
            this.container.style.cssText = this.containerCss;
            if (this.wrapper) this.wrapper.style.cssText = this.wrapperCss;
        }
        this.updateFullscreenButton(on);
    };

    PlayerSync.prototype.updateFullscreenButton = function(isFs) {
        if (!this.fullscreenBtn) return;
        this.fullscreenBtn.title = isFs ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
        this.fullscreenBtn.innerHTML = isFs ? ICONS.fsExit : ICONS.fsEnter;
    };

    PlayerSync.prototype.onFullscreenChange = function() {
        if (this.pseudoFs) return;
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        var isFs = fsEl === this.container;
        if (isFs) {
            this.container.style.cssText = this.containerCss + '; max-width: none; width: 100%; height: 100%; margin: 0; border: none; border-radius: 0; display: flex; flex-direction: column;';
            if (this.wrapper) this.wrapper.style.cssText = this.wrapperCss + '; flex: 1 1 auto; height: auto; padding-bottom: 0;';
        } else {
            this.container.style.cssText = this.containerCss;
            if (this.wrapper) this.wrapper.style.cssText = this.wrapperCss;
        }
        if (this.fullscreenBtn) {
            this.fullscreenBtn.title = isFs ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
            this.fullscreenBtn.innerHTML = isFs ? ICONS.fsExit : ICONS.fsEnter;
        }
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
        var key = function(k) { return '<span style="background-color: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace;">' + k + '</span>'; };
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Video Controls:</div><ul style="color: #ccc; margin-top: 8px; padding-left: 20px;"><li><strong>▶</strong>: Play or pause the video.</li><li style="margin-top: 5px;"><strong>⏮</strong> / <strong>⏭</strong>: Skip backward or forward 10 seconds.</li><li style="margin-top: 5px;"><span style="display: inline-block; vertical-align: middle;">' + ICONS.volHigh + '</span>: Mute or unmute. Hover over it for the volume slider.</li><li style="margin-top: 5px;"><strong>CC</strong>: Turn English captions on or off. Your choice is remembered across lessons.</li><li style="margin-top: 5px;"><strong>1×</strong>: Choose the playback speed. Your speed is remembered across lessons.</li><li style="margin-top: 5px;"><span style="display: inline-block; vertical-align: middle;">' + ICONS.fsEnter + '</span>: Enter or exit fullscreen. The controls stay with you in fullscreen.</li></ul></div>';
        html += '<div style="border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Keyboard Shortcuts:</div><div style="color: #ccc;">Click the video first, then:</div><ul style="color: #ccc; margin-top: 8px; padding-left: 20px;"><li>' + key('Spacebar') + ': Play or pause.</li><li style="margin-top: 5px;">' + key('←') + ' / ' + key('→') + ': Back or forward 5 seconds.</li><li style="margin-top: 5px;">' + key('C') + ': Captions on or off.</li><li style="margin-top: 5px;">' + key('M') + ': Mute or unmute.</li><li style="margin-top: 5px;">' + key('F') + ': Fullscreen.</li></ul></div>';
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Captions in other languages:</div><div style="color: #ccc;">The CC button shows English captions. For other languages, please view the video on YouTube.com.</div></div>';
        html += '<div style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;"><div style="font-weight: bold; color: #3ea6ff; margin-bottom: 6px;">Audio Tracks (English / Hindi):</div><div style="color: #ccc;">This video is available in both English and Hindi. To switch languages, please open the video on YouTube.com, change the audio track there, and then reload this page to apply your choice.</div></div>';
        menu.innerHTML = html;
        if (!this.pseudoFs) this.container.style.position = 'relative';
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

    window.PlayerSync = { players: players, version: '3.1' };

})(window);
