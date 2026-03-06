let player;
let isPlaying = false;
let currentVideoId = null;

// --- State Management ---
let likedSongs = JSON.parse(localStorage.getItem('aura_liked_songs')) || [];
let playlists = JSON.parse(localStorage.getItem('aura_playlists')) || [];
let queue = [];
let currentIndex = -1;

const VIEWS = {
    HOME: 'home-view',
    SEARCH: 'search-view',
    LIKED: 'liked-view',
    PLAYLIST: 'playlist-view',
    QUEUE: 'queue-view'
};

let currentActionSong = null;

// --- YT API ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('yt-player-container', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': () => startProgressLoop()
        }
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayerUI(true);
    } else if (event.data === YT.PlayerState.ENDED) {
        playNext();
    } else {
        isPlaying = false;
        updatePlayerUI(false);
    }
}

// --- Smooth UI Core ---

function updatePlayerUI(playing) {
    const btn = document.getElementById('play-pause-btn');
    btn.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
}

function switchView(viewId, playlistId = null) {
    Object.values(VIEWS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === viewId ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-item, .playlist-item').forEach(el => el.classList.remove('active'));

    if (viewId === VIEWS.HOME) document.getElementById('nav-home').classList.add('active');
    else if (viewId === VIEWS.SEARCH) document.getElementById('nav-search').classList.add('active');
    else if (viewId === VIEWS.LIKED) document.getElementById('nav-liked').classList.add('active');
    else if (viewId === VIEWS.QUEUE) document.getElementById('nav-queue').classList.add('active');

    if (playlistId) {
        const item = document.querySelector(`.playlist-item[data-id="${playlistId}"]`);
        if (item) item.classList.add('active');
        renderPlaylistContent(playlistId);
    } else if (viewId === VIEWS.LIKED) renderLikedContent();
    else if (viewId === VIEWS.QUEUE) renderQueueContent();
}

// --- Data Rendering (Optimized) ---

function createSongCard(song) {
    const isLiked = likedSongs.some(s => s.id === song.id);
    const card = document.createElement('div');
    card.className = 'song-card animate-in';

    card.innerHTML = `
        <div class="card-img-container">
            <img src="${song.thumbnail}" loading="lazy" alt="">
            <div class="play-hover-btn"><i class="fas fa-play"></i></div>
        </div>
        <div class="song-title">${song.title}</div>
        <div class="song-meta">
            <span>Artist</span>
            <div class="card-actions">
                <button class="action-btn like-btn ${isLiked ? 'liked' : ''}">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                </button>
                <button class="action-btn more-btn">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
    `;

    // Click to Play (Sets queue to this song specifically or follows list)
    card.querySelector('.card-img-container').onclick = () => {
        queue = [song];
        currentIndex = 0;
        playCurrent();
    };

    // Like Action (Fixed Bubbling)
    const lBtn = card.querySelector('.like-btn');
    lBtn.onclick = (e) => {
        e.stopPropagation();
        toggleLike(song, lBtn);
    };

    // More Options
    const mBtn = card.querySelector('.more-btn');
    mBtn.onclick = (e) => {
        e.stopPropagation();
        openContextMenu(e, song);
    };

    return card;
}

function renderContent(songs, container) {
    container.innerHTML = '';
    if (!songs.length) {
        container.innerHTML = '<div class="empty-state"><p>Nothing here yet.</p></div>';
        return;
    }
    const fragment = document.createDocumentFragment();
    songs.forEach(s => fragment.appendChild(createSongCard(s)));
    container.appendChild(fragment);
}

// --- Features ---

function toggleLike(song, btn) {
    const idx = likedSongs.findIndex(s => s.id === song.id);
    if (idx === -1) {
        likedSongs.push(song);
        btn.classList.add('liked');
        btn.querySelector('i').className = 'fas fa-heart';
    } else {
        likedSongs.splice(idx, 1);
        btn.classList.remove('liked');
        btn.querySelector('i').className = 'far fa-heart';
        if (document.getElementById(VIEWS.LIKED).style.display === 'block') renderLikedContent();
    }
    localStorage.setItem('aura_liked_songs', JSON.stringify(likedSongs));
    updateSidebarContent();
}

function renderLikedContent() {
    renderContent(likedSongs, document.getElementById('liked-grid'));
}

function renderQueueContent() {
    renderContent(queue, document.getElementById('queue-grid'));
}

function renderPlaylistContent(id) {
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    document.getElementById('playlist-view-title').innerText = pl.name;
    renderContent(pl.songs, document.getElementById('playlist-grid'));
}

// --- Player Core ---

function playCurrent() {
    if (currentIndex < 0 || currentIndex >= queue.length) return;
    const song = queue[currentIndex];

    document.getElementById('current-song-thumb').src = song.thumbnail;
    document.getElementById('current-song-thumb').style.display = 'block';
    document.getElementById('current-song-title').innerText = song.title;
    document.getElementById('current-song-artist').innerText = 'Artist';

    const pLike = document.getElementById('player-like-btn');
    pLike.style.display = 'block';
    const isL = likedSongs.some(s => s.id === song.id);
    pLike.className = `like-btn ${isL ? 'liked' : ''}`;
    pLike.querySelector('i').className = isL ? 'fas fa-heart' : 'far fa-heart';

    currentVideoId = song.id;
    player.loadVideoById(song.id);
}

function playNext() {
    if (currentIndex < queue.length - 1) {
        currentIndex++;
        playCurrent();
    }
}

function playPrev() {
    if (currentIndex > 0) {
        currentIndex--;
        playCurrent();
    }
}

function startProgressLoop() {
    const pBar = document.getElementById('progress-bar');
    const fill = document.getElementById('progress-fill');
    const curT = document.getElementById('current-time');
    const totT = document.getElementById('total-time');

    // Seek interaction
    pBar.onclick = (e) => {
        if (!player || !player.getDuration) return;
        const rect = pBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const seekTo = pos * player.getDuration();
        player.seekTo(seekTo, true);
    };

    setInterval(() => {
        if (isPlaying && player && player.getCurrentTime) {
            const cur = player.getCurrentTime();
            const dur = player.getDuration();
            if (dur > 0) {
                fill.style.width = `${(cur / dur) * 100}%`;
                curT.innerText = formatTime(cur);
                totT.innerText = formatTime(dur);
            }
        }
    }, 500);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
}

// --- Context Menu & Playlists ---

function openContextMenu(e, song) {
    currentActionSong = song;
    const menu = document.getElementById('context-menu');
    const sub = document.getElementById('playlist-submenu');

    // Submenu pop
    sub.innerHTML = '';
    playlists.forEach(pl => {
        const li = document.createElement('li');
        li.innerText = pl.name;
        li.onclick = () => {
            if (!pl.songs.some(s => s.id === song.id)) {
                pl.songs.push(song);
                localStorage.setItem('aura_playlists', JSON.stringify(playlists));
                updateSidebarContent();
            }
            hideMenu();
        };
        sub.appendChild(li);
    });

    menu.style.display = 'block';
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    if (e.pageX + 200 > window.innerWidth) menu.style.left = `${e.pageX - 200}px`;
}

function hideMenu() {
    document.getElementById('context-menu').style.display = 'none';
}

function updateSidebarContent() {
    document.getElementById('liked-count').innerText = `${likedSongs.length} songs`;
    const list = document.getElementById('playlist-list');
    const likedItem = document.getElementById('nav-liked');
    list.innerHTML = '';
    list.appendChild(likedItem);

    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.dataset.id = pl.id;
        div.innerHTML = `<div class="playlist-img"><i class="fas fa-music"></i></div>
            <div class="playlist-info"><div class="playlist-name">${pl.name}</div>
            <div class="playlist-meta">${pl.songs.length} songs</div></div>`;
        div.onclick = () => switchView(VIEWS.PLAYLIST, pl.id);
        list.appendChild(div);
    });
}

// --- Search ---

let searchTimeout;
const sInput = document.getElementById('search-input');

sInput.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const q = sInput.value.trim();
        if (q.length > 2) triggerSearch(q);
    }, 600);
};

sInput.onkeypress = (e) => {
    if (e.key === 'Enter') triggerSearch(sInput.value.trim());
};

async function triggerSearch(q, isSuggestion = false) {
    if (!q) return;

    // Set First Taste if not exists
    if (!localStorage.getItem('aura_first_taste') && !isSuggestion) {
        localStorage.setItem('aura_first_taste', q);
    }

    if (!isSuggestion) switchView(VIEWS.SEARCH);

    const grid = isSuggestion ? document.getElementById('home-grid') : document.getElementById('search-results');
    grid.innerHTML = `<div class="empty-state"><p>${isSuggestion ? 'Curating your home...' : 'Searching...'}</p></div>`;

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const songs = await res.json();
        renderContent(songs, grid);
    } catch (e) {
        grid.innerHTML = '<div class="empty-state"><p>Error loading music.</p></div>';
    }
}

function loadSuggestions() {
    const firstTaste = localStorage.getItem('aura_first_taste');
    if (firstTaste) {
        triggerSearch(firstTaste, true);
    }
}

// --- Global Listeners ---

document.getElementById('nav-home').onclick = () => switchView(VIEWS.HOME);
document.getElementById('nav-search').onclick = () => switchView(VIEWS.SEARCH);
document.getElementById('nav-liked').onclick = () => switchView(VIEWS.LIKED);
document.getElementById('nav-queue').onclick = () => switchView(VIEWS.QUEUE);

document.getElementById('play-pause-btn').onclick = () => isPlaying ? player.pauseVideo() : player.playVideo();
document.getElementById('next-btn').onclick = playNext;
document.getElementById('prev-btn').onclick = playPrev;

document.getElementById('player-like-btn').onclick = () => {
    if (queue[currentIndex]) toggleLike(queue[currentIndex], document.getElementById('player-like-btn'));
};

// Modal
const modal = document.getElementById('playlist-modal');
document.getElementById('add-playlist-btn').onclick = () => modal.style.display = 'flex';
document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
document.getElementById('modal-create').onclick = () => {
    const val = document.getElementById('playlist-name-input').value.trim();
    if (val) {
        const id = 'pl_' + Date.now();
        playlists.push({ id, name: val, songs: [] });
        localStorage.setItem('aura_playlists', JSON.stringify(playlists));
        updateSidebarContent();
        document.getElementById('playlist-name-input').value = '';
        modal.style.display = 'none';
        switchView(VIEWS.PLAYLIST, id);
    }
};

// CM Actions
document.getElementById('cm-play-next').onclick = () => {
    if (currentActionSong) {
        queue.splice(currentIndex + 1, 0, currentActionSong);
        hideMenu();
    }
};
document.getElementById('cm-add-queue').onclick = () => {
    if (currentActionSong) {
        queue.push(currentActionSong);
        hideMenu();
    }
};

document.onclick = hideMenu;

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // Don't trigger when typing in search

    if (e.key === 'ArrowRight') {
        if (player && player.getCurrentTime) {
            player.seekTo(player.getCurrentTime() + 10, true);
        }
    } else if (e.key === 'ArrowLeft') {
        if (player && player.getCurrentTime) {
            player.seekTo(player.getCurrentTime() - 30, true);
        }
    } else if (e.key === ' ') { // Space for play/pause
        e.preventDefault();
        isPlaying ? player.pauseVideo() : player.playVideo();
    }
});

// Init
updateSidebarContent();
loadSuggestions();
switchView(VIEWS.HOME);
