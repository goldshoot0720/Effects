/* The home screen shares the PV player's catalog and playback callbacks. */
window.MV_ARCHIVE = (() => {
  'use strict';

  // Cut lines in the original 1774 × 887 sheets, between the three figures.
  const cast = [
    { id: 'whale', name: '鯨魚娘', code: 'WHALE', top: '8%', cuts: [690, 1115] },
    { id: 'gugu', name: '咕咕嘎嘎', code: 'GUGU GAGA', top: '9%', cuts: [715, 1085] },
    { id: 'feng', name: '鋒兄', code: 'FENG', top: '13%', cuts: [725, 1053] },
    { id: 'tu', name: '塗哥', code: 'TU', top: '15%', cuts: [738, 1056] },
    { id: 'bubu', name: '喵布布', code: 'BUBU', top: '17%', cuts: [724, 1091] },
    { id: 'baibai', name: '喵白白', code: 'BAIBAI', top: '13%', cuts: [733, 1083] },
    { id: 'ya', name: '牙妹', code: 'YA', top: '9%', cuts: [708, 1106] },
    { id: 'yu', name: '魚妹', code: 'YU', top: '12%', cuts: [712, 1088] },
    { id: 'claude', name: 'Claude 娘', code: 'CLAUDE', top: '6%', cuts: [729, 1080] },
    { id: 'gpt', name: 'GPT 娘', code: 'GPT', top: '4%', cuts: [699, 1115] }
  ];
  const languages = { zh: '中文', en: '英文', ja: '日文', yue: '粵語' };
  const covers = ['feng', 'tu', 'bubu', 'feng', 'tu', 'ya', 'feng', 'yu', 'claude'];
  const byId = new Map(cast.map((character, index) => [character.id, { ...character, number: index + 1 }]));
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const picture = (id, view) => 'art/reference/' + id + '-' + view + '.webp';

  function portrait(character, className, loading = 'lazy') {
    const image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.loading = loading;
    image.src = picture(character.id, 'front');
    image.style.setProperty('--portrait-top', character.top);
    return image;
  }

  function mountTurntable() {
    const stage = $('turntableStage');
    const frame = $('angleFrame');
    const image = $('angleImage');
    const buttons = [...document.querySelectorAll('[data-angle]')];
    const labels = ['正面', '側面', '背面'];
    const sheetWidth = 1774;
    const sheetHeight = 887;
    let character, angle = 0, drag;

    function rotate(index) {
      angle = Math.max(0, Math.min(labels.length - 1, index));
      const edges = [0, ...character.cuts, sheetWidth];
      const start = edges[angle], width = edges[angle + 1] - start;
      frame.style.setProperty('--angle-ratio', width / sheetHeight);
      frame.style.setProperty('--angle-width', sheetWidth / width * 100 + '%');
      frame.style.setProperty('--angle-offset', -start / width * 100 + '%');
      const description = labels[angle] + ' ' + angle * 90 + '°';
      image.alt = character.name + ' ' + labels[angle];
      $('angleTag').textContent = description;
      $('angleStatus').textContent = description;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.angle) === angle)));
    }

    buttons.forEach(button => button.addEventListener('click', () => rotate(Number(button.dataset.angle))));
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      stage.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, angle };
    });
    stage.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const distance = Math.max(50, Math.min(145, stage.clientWidth / 4));
      const next = Math.max(0, Math.min(labels.length - 1, drag.angle + Math.round((drag.x - event.clientX) / distance)));
      if (next !== angle) rotate(next);
    });
    stage.addEventListener('lostpointercapture', () => { drag = null; });
    stage.addEventListener('keydown', event => {
      const next = { ArrowLeft: angle - 1, ArrowRight: angle + 1, Home: 0, End: labels.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      rotate(next);
    });

    return entry => {
      character = entry;
      image.src = picture(entry.id, 'turn');
      rotate(0);
    };
  }

  function mountCast() {
    const dialog = $('characterDialog');
    const image = $('characterImage');
    const choices = [...dialog.querySelectorAll('[data-view]')];
    const startTurntable = mountTurntable();
    const turntable = $('turntable');
    const figure = $('characterFigure');
    const labels = { turn: '正面、側面、背面', front: '全身立繪' };
    let character;

    function showView(view) {
      choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
      const rotating = view === 'rotate';
      turntable.hidden = !rotating;
      figure.hidden = rotating;
      if (rotating) return;
      image.src = picture(character.id, view);
      image.alt = character.name + ' ' + labels[view];
      $('characterCaption').textContent = labels[view];
    }

    function openCharacter(entry) {
      character = entry;
      $('characterName').textContent = entry.name;
      $('characterCode').textContent = 'FILE ' + pad(entry.number) + ' / ' + entry.code;
      startTurntable(entry);
      showView('rotate');
      dialog.showModal();
    }

    cast.forEach(entry => {
      const character = byId.get(entry.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card';
      card.appendChild(portrait(character, 'cast-cover'));
      card.insertAdjacentHTML('beforeend', '<span><small></small><strong></strong><b aria-hidden="true">↗</b></span>');
      card.querySelector('small').textContent = pad(character.number) + ' / ' + character.code;
      card.querySelector('strong').textContent = character.name;
      card.addEventListener('click', () => openCharacter(character));
      $('characterGrid').appendChild(card);
    });
    document.querySelectorAll('[data-character]').forEach(button => {
      button.addEventListener('click', () => openCharacter(byId.get(button.dataset.character)));
    });
    choices.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      }
    });
    $('characterCount').textContent = pad(cast.length);
  }

  function mount(songs, play, formatTime, cleanText) {
    const grid = $('grid');
    const filters = $('languageFilters');
    const groups = new Map();
    const versionButtons = new Map();

    songs.forEach((song, index) => {
      const id = song.baseId || song.id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({ song, index });
    });

    const tracks = [...groups.values()].map(versions => {
      const base = versions.find(version => version.song.lang === 'zh') || versions[0];
      const title = cleanText(base.song.title);
      const number = base.song.pv;
      const row = document.createElement('article');
      row.className = 'track';
      row.innerHTML = '<span class="track-number"></span><div class="track-meta"><h3 class="track-title"></h3><p class="track-info"></p></div><div class="track-versions"></div><button type="button" class="track-play"><span aria-hidden="true">▶</span></button>';
      row.querySelector('.track-number').textContent = 'PV ' + pad(number);
      const character = byId.get(covers[number - 1]);
      if (character) {
        const cover = document.createElement('span');
        cover.className = 'track-cover';
        cover.appendChild(portrait(character, '', number <= 2 ? 'eager' : 'lazy'));
        row.insertBefore(cover, row.querySelector('.track-meta'));
      }
      row.querySelector('.track-title').textContent = title;
      const info = row.querySelector('.track-info');
      const versionList = row.querySelector('.track-versions');
      const button = row.querySelector('.track-play');
      let selected = base;

      versions.forEach(({ song, index }) => {
        const language = languages[song.lang];
        const version = document.createElement('button');
        version.type = 'button';
        version.textContent = language;
        version.setAttribute('aria-label', '播放 ' + title + ' ' + language + '版');
        version.addEventListener('click', () => play(index));
        versionButtons.set(song.id, version);
        versionList.appendChild(version);
      });
      button.addEventListener('click', () => play(selected.index));
      grid.appendChild(row);

      return lang => {
        selected = versions.find(version => version.song.lang === lang) || base;
        row.hidden = lang !== 'all' && selected.song.lang !== lang;
        versions.forEach(({ song }) => {
          versionButtons.get(song.id).hidden = lang !== 'all' && song.lang !== lang;
        });
        const { song } = selected;
        info.textContent = cleanText(song.cast) + ' / ' + formatTime(song.dur);
        button.setAttribute('aria-label', '播放 ' + title + ' ' + languages[song.lang] + '版');
      };
    });

    function filter(lang) {
      [...filters.children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
      tracks.forEach(update => update(lang));
    }

    Object.entries({ all: '全部', ...languages }).forEach(([lang, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.lang = lang;
      button.addEventListener('click', () => filter(lang));
      filters.appendChild(button);
    });
    filter('all');
    $('trackCount').textContent = pad(groups.size);
    $('songCount').textContent = songs.length;
    mountCast();

    let current;
    return id => {
      if (current) current.removeAttribute('aria-current');
      current = versionButtons.get(id);
      if (current) current.setAttribute('aria-current', 'true');
    };
  }

  return { mount };
})();
