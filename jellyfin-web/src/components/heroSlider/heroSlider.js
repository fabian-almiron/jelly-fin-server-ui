import { appRouter } from 'components/router/appRouter';
import { playbackManager } from 'components/playback/playbackmanager';
import globalize from 'lib/globalize';

import './heroSlider.scss';

const SLIDE_INTERVAL_MS = 8000;
const TRANSITION_MS = 500;
const MAX_SLIDES = 8;
const MAX_OVERVIEW_CHARS = 200;

// Module-level state — only one hero slider exists on the page at a time
let _timer = null;
let _index = 0;
let _items = [];
let _apiClient = null;
let _rootEl = null;

// ─── Image helpers ────────────────────────────────────────────────────────────

function getImageUrl(item, type, maxWidth) {
    const id = item.Id;
    const tag =
        type === 'Backdrop'
            ? (item.BackdropImageTags || [])[0]
            : (item.ImageTags || {})[type];

    if (!tag) return null;

    return _apiClient.getScaledImageUrl(id, {
        type,
        index: type === 'Backdrop' ? 0 : undefined,
        maxWidth,
        tag
    });
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function buildSlidesHtml(items) {
    return items
        .map((item, i) => {
            const url = getImageUrl(item, 'Backdrop', 1920) || '';
            return `<div class="heroSlider-slide${i === 0 ? ' is-active' : ''}"
                         style="background-image:url('${url}')"
                         data-index="${i}"></div>`;
        })
        .join('');
}

function buildDotsHtml(count) {
    return Array.from({ length: count }, (_, i) =>
        `<button class="heroSlider-dot${i === 0 ? ' is-active' : ''}"
                 data-index="${i}"
                 aria-label="Go to slide ${i + 1}"></button>`
    ).join('');
}

function buildSkeletonHtml(slideCount) {
    return `
        <div class="heroSlider" role="region" aria-label="Featured content">
            <div class="heroSlider-slides">${buildSlidesHtml(_items)}</div>
            <div class="heroSlider-gradient" aria-hidden="true"></div>

            <div class="heroSlider-content">
                <div class="heroSlider-logo" aria-hidden="true"></div>
                <h2 class="heroSlider-title"></h2>
                <div class="heroSlider-meta" role="list"></div>
                <div class="heroSlider-genres"></div>
                <p class="heroSlider-overview"></p>
                <div class="heroSlider-actions">
                    <button class="heroSlider-btn heroSlider-btn--play emby-button" type="button">
                        <span class="material-icons" aria-hidden="true">play_arrow</span>
                        <span>${globalize.translate('Play')}</span>
                    </button>
                    <button class="heroSlider-btn heroSlider-btn--info emby-button" type="button">
                        <span class="material-icons" aria-hidden="true">info_outline</span>
                        <span>${globalize.translate('More')}</span>
                    </button>
                </div>
            </div>

            <nav class="heroSlider-nav" aria-label="Slide navigation">
                <button class="heroSlider-arrow heroSlider-arrow--prev paper-icon-button-light" aria-label="Previous">
                    <span class="material-icons" aria-hidden="true">chevron_left</span>
                </button>
                <div class="heroSlider-dots" role="tablist">
                    ${buildDotsHtml(slideCount)}
                </div>
                <button class="heroSlider-arrow heroSlider-arrow--next paper-icon-button-light" aria-label="Next">
                    <span class="material-icons" aria-hidden="true">chevron_right</span>
                </button>
            </nav>
        </div>`;
}

// ─── Content update ───────────────────────────────────────────────────────────

function updateSlides(index) {
    _rootEl.querySelectorAll('.heroSlider-slide').forEach((el, i) => {
        el.classList.toggle('is-active', i === index);
    });
    _rootEl.querySelectorAll('.heroSlider-dot').forEach((el, i) => {
        el.classList.toggle('is-active', i === index);
        el.setAttribute('aria-selected', String(i === index));
    });
}

function updateContent(index) {
    if (!_rootEl || !_items.length) return;
    const item = _items[index];
    const contentEl = _rootEl.querySelector('.heroSlider-content');

    // Fade out
    contentEl.classList.add('is-transitioning');

    setTimeout(() => {
        // Logo vs title
        const logoUrl = getImageUrl(item, 'Logo', 420);
        const logoEl = _rootEl.querySelector('.heroSlider-logo');
        const titleEl = _rootEl.querySelector('.heroSlider-title');

        if (logoUrl) {
            logoEl.style.backgroundImage = `url('${logoUrl}')`;
            logoEl.hidden = false;
            titleEl.hidden = true;
        } else {
            logoEl.hidden = true;
            logoEl.style.backgroundImage = '';
            titleEl.textContent = item.Name || '';
            titleEl.hidden = false;
        }

        // Badges
        const metaEl = _rootEl.querySelector('.heroSlider-meta');
        const badges = [];
        if (item.Type) {
            badges.push(`<span class="heroSlider-badge heroSlider-badge--type" role="listitem">${item.Type}</span>`);
        }
        if (item.ProductionYear) {
            badges.push(`<span class="heroSlider-badge heroSlider-badge--year" role="listitem">${item.ProductionYear}</span>`);
        }
        if (item.OfficialRating) {
            badges.push(`<span class="heroSlider-badge heroSlider-badge--rating" role="listitem">${item.OfficialRating}</span>`);
        }
        if (item.CommunityRating) {
            badges.push(`<span class="heroSlider-badge heroSlider-badge--score" role="listitem">★ ${item.CommunityRating.toFixed(1)}</span>`);
        }
        metaEl.innerHTML = badges.join('');

        // Genres
        const genresEl = _rootEl.querySelector('.heroSlider-genres');
        if (item.Genres?.length) {
            genresEl.innerHTML = item.Genres
                .slice(0, 3)
                .map(g => `<span class="heroSlider-genre">${g}</span>`)
                .join('');
            genresEl.hidden = false;
        } else {
            genresEl.hidden = true;
        }

        // Overview
        const overviewEl = _rootEl.querySelector('.heroSlider-overview');
        if (item.Overview) {
            overviewEl.textContent =
                item.Overview.length > MAX_OVERVIEW_CHARS
                    ? `${item.Overview.slice(0, MAX_OVERVIEW_CHARS - 1)}\u2026`
                    : item.Overview;
            overviewEl.hidden = false;
        } else {
            overviewEl.hidden = true;
        }

        contentEl.classList.remove('is-transitioning');
    }, TRANSITION_MS / 2);
}

// ─── Slide navigation ─────────────────────────────────────────────────────────

function goTo(index) {
    if (!_items.length) return;
    _index = ((index % _items.length) + _items.length) % _items.length;
    updateSlides(_index);
    updateContent(_index);
}

function startTimer() {
    stopTimer();
    _timer = setInterval(() => goTo(_index + 1), SLIDE_INTERVAL_MS);
}

function stopTimer() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
}

// ─── Playback ─────────────────────────────────────────────────────────────────

function playCurrentItem() {
    const item = _items[_index];
    if (!item) return;
    playbackManager.play({ items: [item], startIndex: 0 });
}

function showCurrentItemDetails() {
    const item = _items[_index];
    if (!item) return;
    appRouter.showItem(item);
}

// ─── Touch/swipe ─────────────────────────────────────────────────────────────

function attachSwipe(el) {
    let startX = 0;
    el.addEventListener('touchstart', e => { startX = e.changedTouches[0].screenX; }, { passive: true });
    el.addEventListener('touchend', e => {
        const delta = startX - e.changedTouches[0].screenX;
        if (Math.abs(delta) > 50) goTo(_index + (delta > 0 ? 1 : -1));
    }, { passive: true });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadHeroSlider(container, apiClient, user) {
    _apiClient = apiClient;
    container.classList.remove('heroSliderWrapper--empty');
    const userId = user.Id || apiClient.getCurrentUserId();

    let result;
    try {
        result = await apiClient.getItems(userId, {
            SortBy: 'DateCreated,SortName',
            SortOrder: 'Descending',
            IncludeItemTypes: 'Movie,Series',
            Recursive: true,
            Fields: 'Overview,Genres,ProductionYear,CommunityRating,OfficialRating,BackdropImageTags,ImageTags',
            EnableImageTypes: 'Backdrop,Primary,Logo',
            ImageTypeLimit: 1,
            Limit: 20,
            EnableTotalRecordCount: false
        });
    } catch (err) {
        console.error('[HeroSlider] Failed to fetch items:', err);
        container.innerHTML = '';
        container.classList.add('heroSliderWrapper--empty');
        return;
    }

    _items = (result.Items || [])
        .filter(item => item.BackdropImageTags?.length > 0)
        .map(item => ({ ...item, ServerId: item.ServerId || apiClient.serverId() }))
        .slice(0, MAX_SLIDES);

    if (!_items.length) {
        container.innerHTML = '';
        container.classList.add('heroSliderWrapper--empty');
        return;
    }

    _index = 0;
    container.innerHTML = buildSkeletonHtml(_items.length);
    _rootEl = container.querySelector('.heroSlider');

    // Prime first slide
    updateContent(0);
    startTimer();

    // ── Event wiring ──────────────────────────────────────────────────────────
    _rootEl.querySelector('.heroSlider-arrow--prev')
        .addEventListener('click', () => { goTo(_index - 1); startTimer(); });

    _rootEl.querySelector('.heroSlider-arrow--next')
        .addEventListener('click', () => { goTo(_index + 1); startTimer(); });

    _rootEl.querySelectorAll('.heroSlider-dot').forEach(dot => {
        dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index, 10)); startTimer(); });
    });

    _rootEl.querySelector('.heroSlider-btn--play')
        .addEventListener('click', playCurrentItem);

    _rootEl.querySelector('.heroSlider-btn--info')
        .addEventListener('click', showCurrentItemDetails);

    // Pause auto-advance while user is hovering (desktop)
    _rootEl.addEventListener('mouseenter', stopTimer);
    _rootEl.addEventListener('mouseleave', startTimer);

    // Swipe on touch devices
    attachSwipe(_rootEl);
}

export function pauseHeroSlider() {
    stopTimer();
}

export function resumeHeroSlider() {
    if (_rootEl && _items.length) startTimer();
}

export function destroyHeroSlider() {
    stopTimer();
    _items = [];
    _index = 0;
    _apiClient = null;
    _rootEl = null;
}

export default { loadHeroSlider, pauseHeroSlider, resumeHeroSlider, destroyHeroSlider };
