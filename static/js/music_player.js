let player;
let currentVideoId = null;
let isPlaying = false;
let currentQueue = [];
let currentTrackIndex = 0;
let isShuffleOn = false;
let isRepeatOn = false;
let updateTimeInterval;

// Initialize YouTube Player
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtubePlayer', {
        height: '0',
        width: '0',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    updateVolume($("#volumeSlider").val());
    setupTimelineUpdater();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        if (isRepeatOn) {
            player.seekTo(0);
            player.playVideo();
        } else {
            playNextTrack();
        }
    } else if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayPauseButton();
        startTimelineUpdate();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayPauseButton();
        stopTimelineUpdate();
    }
}

// Timeline Management
function setupTimelineUpdater() {
    const timelineSlider = $("#timelineSlider");
    
    timelineSlider.on('input', function() {
        stopTimelineUpdate();
    });
    
    timelineSlider.on('change', function() {
        const time = (player.getDuration() * $(this).val()) / 100;
        player.seekTo(time);
        startTimelineUpdate();
    });
}

function startTimelineUpdate() {
    stopTimelineUpdate();
    updateTimeInterval = setInterval(updateTimeline, 1000);
}

function stopTimelineUpdate() {
    if (updateTimeInterval) {
        clearInterval(updateTimeInterval);
    }
}

function updateTimeline() {
    if (player && player.getCurrentTime && player.getDuration) {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        const percentage = (currentTime / duration) * 100;
        
        $("#timelineSlider").val(percentage);
        $("#currentTime").text(formatTime(currentTime));
        $("#totalTime").text(formatTime(duration));
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Search functionality
$("#searchBtn").click(function() {
    const query = $("#searchInput").val();
    if (query.trim()) {
        searchSongs(query);
    }
});

$("#searchInput").keypress(function(e) {
    if (e.which == 13) {
        const query = $(this).val();
        if (query.trim()) {
            searchSongs(query);
        }
    }
});

function searchSongs(query) {
    $("#searchResults").html('<div class="text-center text-light"><i class="fas fa-spinner fa-spin"></i> Searching...</div>');
    
    $.ajax({
        url: '/search',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ query: query }),
        success: function(response) {
            displaySearchResults(response.results);
        },
        error: function(error) {
            $("#searchResults").html('<div class="text-danger">Search failed. Please try again.</div>');
        }
    });
}

function displaySearchResults(results) {
    const container = $("#searchResults");
    container.empty();
    
    if (results.length === 0) {
        container.html('<div class="text-muted">No results found</div>');
        return;
    }
    
    results.forEach(song => {
        const resultItem = $(`
            <div class="search-result-item d-flex align-items-center gap-3">
                <img src="${song.thumbnail}" alt="${song.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                <div class="flex-grow-1">
                    <h6 class="text-light mb-0 text-truncate">${song.title}</h6>
                    <small class="text-muted">${song.artists.join(', ')}</small>
                </div>
                <button class="btn btn-link text-light add-to-queue-btn">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `);
        
        resultItem.find('.add-to-queue-btn').click((e) => {
            e.stopPropagation();
            addToQueue(song);
        });
        
        resultItem.click(() => {
            addToQueue(song, true);
        });
        
        container.append(resultItem);
    });
}

// Queue Management
function addToQueue(song, playImmediately = false) {
    $.ajax({
        url: '/add_to_queue',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(song),
        success: function(response) {
            if (playImmediately || currentQueue.length === 0) {
                loadAndPlayTrack(song);
            }
            updateQueueDisplay();
        }
    });
}

function updateQueueDisplay() {
    $.get('/get_queue', function(response) {
        currentQueue = response.queue;
        currentTrackIndex = response.current_index;
        
        const queueList = $("#queueList");
        queueList.empty();
        
        if (currentQueue.length === 0) {
            queueList.html('<div class="text-muted">Queue is empty</div>');
            return;
        }
        
        currentQueue.forEach((track, index) => {
            const queueItem = $(`
                <div class="queue-item d-flex align-items-center gap-3 ${index === currentTrackIndex ? 'active' : ''}">
                    <div class="queue-number text-muted">${index + 1}</div>
                    <img src="${track.thumbnail}" alt="${track.title}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                    <div class="flex-grow-1">
                        <h6 class="text-light mb-0 text-truncate">${track.title}</h6>
                        <small class="text-muted">${track.artists.join(', ')}</small>
                    </div>
                    <button class="btn btn-link text-light remove-from-queue-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);
            
            queueItem.click(() => jumpToTrack(index));
            queueList.append(queueItem);
        });
    });
}

// Playback Controls
function loadAndPlayTrack(track) {
    if (!track || !track.videoId) return;
    
    if (track.videoId === currentVideoId) {
        togglePlayPause();
        return;
    }
    
    currentVideoId = track.videoId;
    player.loadVideoById(currentVideoId);
    updateNowPlayingInfo(track);
    isPlaying = true;
    updatePlayPauseButton();
}

function updateNowPlayingInfo(track) {
    $("#songTitle").text(track.title);
    $("#artistName").text(track.artists.join(', '));
    $("#albumArt").attr('src', track.thumbnail);
    $(".album-art-container").addClass('playing');
}

function togglePlayPause() {
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function updatePlayPauseButton() {
    const icon = isPlaying ? 'fa-pause' : 'fa-play';
    $("#playPauseBtn i").attr('class', `fas ${icon}`);
}

function playNextTrack() {
    if (isShuffleOn) {
        playRandomTrack();
    } else {
        $.get('/next_track', function(track) {
            if (track) {
                loadAndPlayTrack(track);
                updateQueueDisplay();
            }
        });
    }
}

function playPreviousTrack() {
    $.get('/previous_track', function(track) {
        if (track) {
            loadAndPlayTrack(track);
            updateQueueDisplay();
        }
    });
}

function playRandomTrack() {
    if (currentQueue.length <= 1) return;
    
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * currentQueue.length);
    } while (randomIndex === currentTrackIndex);
    
    jumpToTrack(randomIndex);
}

function jumpToTrack(index) {
    if (index >= 0 && index < currentQueue.length) {
        loadAndPlayTrack(currentQueue[index]);
        currentTrackIndex = index;
        updateQueueDisplay();
    }
}

function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    $("#shuffleBtn").toggleClass('active', isShuffleOn);
}

function toggleRepeat() {
    isRepeatOn = !isRepeatOn;
    $("#repeatBtn").toggleClass('active', isRepeatOn);
}

function updateVolume(value) {
    if (player) {
        player.setVolume(value);
        const icon = value == 0 ? 'fa-volume-mute' : 
                    value < 50 ? 'fa-volume-down' : 
                    'fa-volume-up';
        $(".volume-container i").attr('class', `fas ${icon}`);
    }
}

// Event Listeners
$("#playPauseBtn").click(togglePlayPause);
$("#nextBtn").click(playNextTrack);
$("#prevBtn").click(playPreviousTrack);
$("#shuffleBtn").click(toggleShuffle);
$("#repeatBtn").click(toggleRepeat);
$("#volumeSlider").on('input', function() {
    updateVolume($(this).val());
});
$("#clearQueueBtn").click(function() {
    currentQueue = [];
    currentTrackIndex = 0;
    updateQueueDisplay();
    player.stopVideo();
    isPlaying = false;
    updatePlayPauseButton();
    $("#songTitle").text("No Track Selected");
    $("#artistName").text("Select a track to play");
    $(".album-art-container").removeClass('playing');
});

// Initialize
$(document).ready(function() {
    updateQueueDisplay();
});
