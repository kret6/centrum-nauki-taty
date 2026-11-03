// Interfejs kursu niemieckiego: plan, lekcje, zadania, nagrania i postęp zapisany w przeglądarce.
(function () {
  var KLUCZ = 'centrum_taty_niem_postep';
  var KLUCZ_SZYFRU = 'centrum_taty_klucz';
  var L, B, S = window.KursNiem;
  var app = document.getElementById('aplikacja');

  function wczytaj() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(KLUCZ)); } catch (e) { p = null; }
    p = p || {};
    p.zadania = p.zadania || {}; p.lekcje = p.lekcje || {}; p.tekst = p.tekst || {}; p.slowa = p.slowa || {};
    return p;
  }
  var stan = wczytaj();
  function zapisz() { if (L) stan.razem = L.length; try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); } catch (e) { /* postęp zostanie do zamknięcia karty */ } }
  function dzis() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function el(tag, a) {
    var n = document.createElement(tag);
    for (var k in (a || {})) {
      if (k === 'html') n.innerHTML = a[k];
      else if (k === 'text') n.textContent = a[k];
      else if (k.indexOf('on') === 0) n[k] = a[k];
      else n.setAttribute(k, a[k]);
    }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) n.appendChild(arguments[i]);
    return n;
  }
  function wyczysc(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function zBase64(s) {
    var z = atob(s.replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(z.length);
    for (var i = 0; i < z.length; i++) b[i] = z.charCodeAt(i);
    return b;
  }
  function nastepna() {
    for (var i = 0; i < L.length; i++) if (!stan.lekcje[L[i].nr]) return L[i];
    return null;
  }
  function robionaDzis() {
    for (var nr in stan.lekcje) if (stan.lekcje[nr] === dzis()) return true;
    return false;
  }
  function zadanieId(l, i) { return l.nr + '.' + (i + 1); }

  // Pasek znaków na telefon: wstawia do pola to, czego brakuje na polskiej klawiaturze.
  function znaki(pole) {
    var p = el('div', { class: 'znaki', 'aria-label': 'Niemieckie znaki' });
    ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü', '„', '“'].forEach(function (z) {
      var b = el('button', { type: 'button', text: z, onclick: function () { pole.setRangeText(z, pole.selectionStart, pole.selectionEnd, 'end'); pole.focus(); } });
      b.onpointerdown = function (e) { e.preventDefault(); };
      b.onmousedown = function (e) { e.preventDefault(); };
      p.appendChild(b);
    });
    return p;
  }

  // --- nagrania ---
  function adresAudio(l) { return 'audio/' + l.audio + (window.KursSzyfr ? '.mp3.szyfr' : '.mp3'); }
  function zrodloAudio(l) {
    if (!window.KursSzyfr) return Promise.resolve(adresAudio(l));
    return fetch(adresAudio(l)).then(function (o) {
      if (!o.ok) throw new Error('HTTP ' + o.status);
      return o.arrayBuffer();
    }).then(function (b) {
      return crypto.subtle.importKey('raw', zBase64(czytajKlucz()), 'AES-GCM', false, ['decrypt']).then(function (ck) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b, 0, 12) }, ck, new Uint8Array(b, 12));
      });
    }).then(function (mp3) { return URL.createObjectURL(new Blob([mp3], { type: 'audio/mpeg' })); });
  }
  function odtwarzacz(l) {
    if (!l.audio) return el('div', { class: 'bezaudio mala', text: '🎧 Nagranie tej lekcji jeszcze nie powstało. Rozmowa i zdania do powtórzenia są niżej, do czytania.' });
    var box = el('div', { class: 'audio' });
    var przycisk = el('button', { class: 'g', text: '🎧 Posłuchaj i mów (ok. ' + l.audioMin + ' min)', onclick: function () {
      przycisk.disabled = true; przycisk.textContent = '⏳ Przygotowuję nagranie…';
      zrodloAudio(l).then(function (src) {
        var a = el('audio', { controls: 'controls', src: src, preload: 'auto', 'aria-label': 'Nagranie lekcji ' + l.nr });
        wyczysc(box); box.appendChild(a);
        if ('mediaSession' in navigator && window.MediaMetadata) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: 'Lektion ' + l.nr + '. ' + l.tytulDe, artist: 'Centrum Nauki Taty', album: 'Niemiecki' });
        }
        var p = a.play();
        if (p && p.catch) p.catch(function () { /* start ręczny z kontrolek */ });
      }).catch(function () {
        wyczysc(box);
        box.appendChild(el('div', { class: 'msg zle', text: '❌ Nie mogę pobrać nagrania. Bez zasięgu działa tylko to, które było już odtwarzane lub przygotowane.' }));
      });
    } });
    box.appendChild(przycisk);
    return box;
  }

  // --- słówka: wymowa z głosu telefonu i powtórki w coraz dłuższych odstępach ---
  var ODSTEPY = [1, 3, 7, 21, 60];
  function dataZaDni(n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function wymow(t) {
    if (!('speechSynthesis' in window)) return;
    // same słowo: bez przypadka i końcówki liczby mnogiej
    var u = new SpeechSynthesisUtterance(t.replace(/,.*$/, '').replace(/ \+ [A-Z]\.$/, '').replace(/ \(Pl\.\)$/, ''));
    u.lang = 'de-DE'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function przyciskWymowy(t) {
    if (!('speechSynthesis' in window)) return null;
    return el('button', { class: 'mow', type: 'button', text: '🔊', 'aria-label': 'Wymowa: ' + t, onclick: function (e) { e.stopPropagation(); wymow(t); } });
  }
  function slowkaLekcji(nr) { return (window.NiemSlowka || {})[nr] || []; }
  function doPowtorki() {
    var w = [], dzisiaj = dzis();
    L.forEach(function (l) {
      slowkaLekcji(l.nr).forEach(function (s) {
        var st = stan.slowa[s.de];
        if (st && st.t <= dzisiaj) w.push(s);
      });
    });
    return w;
  }
  function ocen(s, umiem) {
    var st = stan.slowa[s.de] || { b: 0 };
    st.b = umiem ? Math.min((st.t ? st.b + 1 : 0), ODSTEPY.length - 1) : 0;
    st.t = dataZaDni(ODSTEPY[st.b]);
    stan.slowa[s.de] = st;
    zapisz();
  }
  function kartaSlowek(l) {
    var lista = slowkaLekcji(l.nr);
    if (!lista.length) return null;
    var nauczone = lista.filter(function (s) { return stan.slowa[s.de]; }).length;
    var k = el('details', { class: 'karta', id: 'slowka' }, el('summary', { text: '📚 Słówka (' + lista.length + ')' + (nauczone ? ', przećwiczone: ' + nauczone : '') }));
    k.appendChild(el('div', { class: 'przyciski', style: 'margin-bottom:8px' }, el('a', { class: 'btn g', href: '#slowka/' + l.nr, text: 'Ćwicz na fiszkach' })));
    lista.forEach(function (s) {
      k.appendChild(el('div', { class: 'slowo' }, el('div', {}, el('div', { class: 'haslo', text: s.de }), el('div', { text: s.pl }), el('div', { class: 'przyklad', text: s.ex })), przyciskWymowy(s.de)));
    });
    return k;
  }
  function widokFiszek(zestaw, tytul, powrot) {
    var kolejka = zestaw.slice(), zrobione = 0, razem = zestaw.length, drugiRaz = {};
    window.scrollTo(0, 0);
    function pokaz() {
      wyczysc(app);
      app.appendChild(el('p', {}, el('a', { href: powrot, text: '← Wróć' })));
      app.appendChild(el('h1', { text: tytul }));
      if (!kolejka.length) {
        app.appendChild(el('div', { class: 'msg ok', text: razem ? '✅ Koniec. Słówka wrócą w powtórce, gdy przyjdzie ich czas.' : 'Dziś nie ma nic do powtórzenia.' }));
        app.appendChild(el('div', { class: 'przyciski' }, el('a', { class: 'btn g', href: powrot, text: 'Wróć' })));
        return;
      }
      var s = kolejka[0];
      var dol = el('div');
      var karta = el('div', { class: 'karta fiszka' }, el('div', { class: 'mala', text: 'Zrobione ' + zrobione + ' z ' + razem }), el('div', { class: 'pol', text: s.pl }), dol);
      dol.appendChild(el('div', { class: 'przyciski', style: 'margin-top:18px' }, el('button', { class: 'g', text: 'Pokaż po niemiecku', onclick: function () {
        wyczysc(dol);
        dol.appendChild(el('div', { class: 'haslo', text: s.de }));
        dol.appendChild(el('div', { class: 'przyklad', text: s.ex }));
        dol.appendChild(el('div', { class: 'przyciski' }, przyciskWymowy(s.de)));
        dol.appendChild(el('div', { class: 'przyciski' },
          el('button', { class: 'g', text: 'Umiem', onclick: function () {
            if (!drugiRaz[s.de]) ocen(s, true);
            kolejka.shift(); zrobione++; pokaz();
          } }),
          el('button', { text: 'Jeszcze nie', onclick: function () {
            // wraca jeszcze w tej sesji, a w planie powtórek zaczyna od nowa
            if (!drugiRaz[s.de]) ocen(s, false);
            drugiRaz[s.de] = true;
            kolejka.push(kolejka.shift()); pokaz();
          } })));
      } })));
      app.appendChild(karta);
    }
    pokaz();
  }

  // --- plan ---
  function widokPlanu() {
    wyczysc(app);
    window.scrollTo(0, 0);
    var ile = Object.keys(stan.lekcje).length, nast = nastepna(), dzisiaj = robionaDzis();
    app.appendChild(el('p', {}, el('a', { href: '../index.html', text: '← Centrum Nauki Taty' })));
    app.appendChild(el('h1', { text: '🇩🇪 Niemiecki' }));
    app.appendChild(el('p', { class: 'mala', text: L.length + ' lekcji po kilkanaście minut. Nagranie można robić w drodze, zadania na ekranie, gdy czekasz.' }));

    var k = el('div', { class: 'karta dzis' });
    if (!nast) {
      k.appendChild(el('h3', { text: '🎉 Kurs ukończony' }));
      k.appendChild(el('p', { text: 'Wszystkie lekcje są zrobione. Nagrania warto puszczać ponownie.' }));
    } else if (dzisiaj) {
      k.appendChild(el('h3', { text: '✅ Dzisiejsza lekcja jest zrobiona' }));
      k.appendChild(el('p', { text: 'Jutro: lekcja ' + nast.nr + '. ' + nast.tytul + '.' }));
      k.appendChild(el('div', { class: 'przyciski' }, el('a', { class: 'btn', href: '#lekcja/' + nast.nr, text: 'Mam ochotę już dziś' })));
    } else {
      k.appendChild(el('div', { class: 'mala', text: 'Dzisiaj, około 15 minut' }));
      k.appendChild(el('h3', { text: 'Lekcja ' + nast.nr + '. ' + nast.tytul }));
      k.appendChild(el('p', { text: nast.cel }));
      if (nast.audio) k.appendChild(odtwarzacz(nast));
      k.appendChild(el('div', { class: 'przyciski' }, el('a', { class: 'btn' + (nast.audio ? '' : ' g'), href: '#lekcja/' + nast.nr, text: nast.audio ? 'Otwórz lekcję i zadania' : 'Zaczynam' })));
      // nagranie na dziś trafia do pamięci telefonu, póki jest zasięg
      if (nast.audio && window.KursSzyfr) fetch(adresAudio(nast)).catch(function () { /* spróbujemy przy odtwarzaniu */ });
    }
    k.appendChild(el('div', { class: 'pasek', role: 'img', 'aria-label': 'Postęp: ' + ile + ' z ' + L.length }, el('i', { style: 'width:' + Math.round(100 * ile / L.length) + '%' })));
    k.appendChild(el('div', { class: 'mala', text: 'Zrobione: ' + ile + ' z ' + L.length }));
    app.appendChild(k);

    var powtorka = doPowtorki().length;
    if (powtorka) app.appendChild(el('div', { class: 'karta' }, el('h3', { text: '🔁 Słówka do powtórki: ' + powtorka }), el('p', { class: 'mala', text: 'Kilka minut na fiszkach, można też zamiast lekcji.' }), el('a', { class: 'btn g', href: '#slowka', text: 'Powtórz' })));

    B.forEach(function (blok, nrB) {
      app.appendChild(el('h2', { text: blok.nazwa }));
      app.appendChild(el('p', { class: 'mala', text: blok.opis }));
      var lista = el('div', { class: 'karta lista' });
      L.filter(function (l) { return l.blok === nrB; }).forEach(function (l) {
        var zrob = !!stan.lekcje[l.nr], akt = nast && nast.nr === l.nr;
        var a = el('a', { href: '#lekcja/' + l.nr, class: akt ? 'aktualna' : '' });
        a.appendChild(el('span', { class: 'st', text: zrob ? '✅ zrobiona' : akt ? '▶ następna' : '○ przed Tobą' }));
        a.appendChild(el('span', { text: l.nr + '. ' + l.tytul + (l.audio ? ' 🎧' : '') }));
        lista.appendChild(a);
      });
      app.appendChild(lista);
    });

    if (ile) {
      app.appendChild(el('p', { class: 'mala', style: 'margin-top:28px' }, el('a', { href: '#', text: 'Wyzeruj postęp', onclick: function (e) {
        e.preventDefault();
        if (confirm('Na pewno wyzerować cały postęp kursu?')) { stan = { zadania: {}, lekcje: {}, tekst: {}, slowa: {} }; zapisz(); widokPlanu(); }
      } })));
    }
  }

  // --- zadania ---
  var stopka = null;
  function zaliczone(l, i, kartaStan) {
    stan.zadania[zadanieId(l, i)] = true;
    kartaStan.textContent = '✅ zaliczone'; kartaStan.className = 'stan ok';
    var wszystkie = l.zadania.every(function (_, j) { return stan.zadania[zadanieId(l, j)]; });
    if (wszystkie && !stan.lekcje[l.nr]) stan.lekcje[l.nr] = dzis();
    zapisz();
    odswiezStopke(l);
  }
  function glowa(l, i) {
    var sw = stan.zadania[zadanieId(l, i)];
    var st = el('span', { class: 'stan' + (sw ? ' ok' : ''), text: sw ? '✅ zaliczone' : '○ do zrobienia' });
    return { st: st, wiersz: el('div', { class: 'glowa' }, el('h3', { text: 'Zadanie ' + (i + 1) }), st) };
  }
  function kartaQuiz(l, z, i) {
    var g = glowa(l, i), m = el('div');
    var k = el('div', { class: 'karta' }, g.wiersz, el('div', { html: z.tresc }));
    z.opcje.map(function (t, n) { return { t: t, n: n, r: Math.random() }; }).sort(function (a, b) { return a.r - b.r; }).forEach(function (o) {
      k.appendChild(el('button', { class: 'opcja', text: o.t, onclick: function () {
        wyczysc(m);
        if (o.n === z.poprawna) { m.appendChild(el('div', { class: 'msg ok', html: '✅ Dobrze. ' + z.wyjasnienie })); zaliczone(l, i, g.st); }
        else m.appendChild(el('div', { class: 'msg zle', text: '❌ Nie, spróbuj jeszcze raz.' }));
      } }));
    });
    k.appendChild(m);
    return k;
  }
  function kartaLuka(l, z, i) {
    var id = zadanieId(l, i), g = glowa(l, i), wy = el('div'), pod = el('div');
    var pole = el('input', { class: 'luka', type: 'text', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Odpowiedź' });
    pole.value = stan.tekst[id] || '';
    function sprawdz() {
      stan.tekst[id] = pole.value; zapisz();
      wyczysc(wy);
      var r = S.sprawdzLuke(pole.value, z.ok);
      if (r.ok) {
        wy.appendChild(el('div', { class: 'msg ok', html: '✅ Dobrze. ' + (r.uwaga ? r.uwaga + '. ' : '') + z.wyjasnienie }));
        zaliczone(l, i, g.st);
      } else wy.appendChild(el('div', { class: 'msg zle', text: '❌ ' + r.powod }));
    }
    pole.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sprawdz(); } };
    return el('div', { class: 'karta' }, g.wiersz, el('div', { html: z.tresc }), el('div', { style: 'height:8px' }), pole, znaki(pole),
      el('div', { class: 'przyciski' },
        el('button', { class: 'g', text: 'Sprawdź', onclick: sprawdz }),
        el('button', { text: 'Podpowiedź', onclick: function () { wyczysc(pod); pod.appendChild(el('div', { class: 'msg info', text: '💡 ' + z.podpowiedz })); } }),
        el('button', { text: 'Pokaż odpowiedź', onclick: function () { wyczysc(pod); pod.appendChild(el('div', { class: 'msg info', text: z.ok[0] })); } })),
      pod, wy);
  }
  function kartaPisanie(l, z, i) {
    var id = zadanieId(l, i), g = glowa(l, i), wy = el('div');
    var pole = el('textarea', { spellcheck: 'true', lang: 'de', 'aria-label': 'Twój tekst' });
    pole.value = stan.tekst[id] || '';
    pole.oninput = function () { stan.tekst[id] = pole.value; zapisz(); };
    function pokaz() {
      stan.tekst[id] = pole.value; zapisz();
      wyczysc(wy);
      var w = S.sprawdzElementy(pole.value, z.elementy);
      var lista = el('ul');
      w.forEach(function (e) { lista.appendChild(el('li', { text: (e.jest ? '✅ ma: ' : '○ brak: ') + e.opis })); });
      wy.appendChild(el('div', { class: 'msg info' }, el('div', { text: 'To tylko sprawdzenie, czy elementy są w tekście. Poprawności językowej aplikacja nie ocenia.' }), lista));
      wy.appendChild(el('div', { class: 'msg info' }, el('b', { text: 'Wzór: ' }), el('span', { text: z.wzor })));
      wy.appendChild(el('div', { class: 'przyciski' }, el('button', { class: 'g', text: 'Porównałem, zaliczam', onclick: function () { zaliczone(l, i, g.st); } })));
    }
    return el('div', { class: 'karta' }, g.wiersz, el('div', { html: z.tresc }), el('div', { style: 'height:8px' }), pole, znaki(pole),
      el('div', { class: 'przyciski' }, el('button', { class: 'g', text: 'Porównaj ze wzorem', onclick: pokaz })), wy);
  }
  function odswiezStopke(l) {
    if (!stopka) return;
    wyczysc(stopka);
    var po = L[l.nr];
    if (stan.lekcje[l.nr]) {
      stopka.appendChild(el('div', { class: 'msg ok', text: '✅ Lekcja zrobiona.' + (po ? ' Następna: ' + po.tytul + '.' : ' To była ostatnia!') }));
      stopka.appendChild(el('div', { class: 'przyciski' },
        el('a', { class: 'btn g', href: '#', text: 'Wróć do planu' }),
        po ? el('a', { class: 'btn', href: '#lekcja/' + po.nr, text: 'Kolejna lekcja' }) : null));
    } else {
      stopka.appendChild(el('div', { class: 'przyciski' },
        el('a', { class: 'btn', href: '#', text: 'Wróć do planu' }),
        el('button', { text: 'Pomiń resztę i oznacz jako zrobioną', onclick: function () { stan.lekcje[l.nr] = dzis(); zapisz(); odswiezStopke(l); } })));
    }
  }
  var NAZWY = { K: 'Berater', B: 'Kundin' };
  function widokLekcji(nr) {
    var l = L[nr - 1];
    if (!l) { location.hash = ''; return; }
    wyczysc(app);
    window.scrollTo(0, 0);
    app.appendChild(el('p', {}, el('a', { href: '#', text: '← Plan kursu' })));
    app.appendChild(el('div', { class: 'mala', text: 'Lekcja ' + l.nr + ' z ' + L.length + ' · ' + B[l.blok].nazwa }));
    app.appendChild(el('h1', { text: l.tytul }));
    app.appendChild(el('p', { text: l.cel }));
    app.appendChild(odtwarzacz(l));
    app.appendChild(el('div', { class: 'karta', html: l.teoria }));
    var slowka = kartaSlowek(l);
    if (slowka) app.appendChild(slowka);

    var rozmowa = el('div');
    l.rozmowa.forEach(function (r) { rozmowa.appendChild(el('p', { class: 'replika' }, el('b', { text: (l.nazwy || NAZWY)[r[0]] + ': ' }), el('span', { text: r[1] }))); });
    app.appendChild(el('details', { class: 'karta' }, el('summary', { text: '💬 Rozmowa z nagrania' }), rozmowa));

    var dril = el('div');
    l.dril.forEach(function (d) {
      var de = el('div', { class: 'de', text: d.de, hidden: 'hidden' });
      var w = el('div', { class: 'dril' }, el('div', { text: d.pl }), de);
      w.onclick = function () { de.hidden = false; };
      dril.appendChild(w);
    });
    app.appendChild(el('div', { class: 'karta' }, el('h3', { text: '🗣️ Powiedz na głos' }), el('p', { class: 'mala', text: 'Powiedz zdanie po niemiecku, potem dotknij je, żeby zobaczyć wersję wzorcową.' }), dril));

    app.appendChild(el('h2', { text: 'Zadania' }));
    l.zadania.forEach(function (z, i) {
      app.appendChild(z.typ === 'quiz' ? kartaQuiz(l, z, i) : z.typ === 'luka' ? kartaLuka(l, z, i) : kartaPisanie(l, z, i));
    });
    app.appendChild(el('div', { class: 'karta praktyka' }, el('h3', { text: '💼 W prawdziwej rozmowie' }), el('div', { html: l.wPraktyce })));
    stopka = el('div');
    app.appendChild(stopka);
    odswiezStopke(l);
  }
  function trasa() {
    var m = /^#lekcja\/(\d+)$/.exec(location.hash);
    var f = /^#slowka\/(\d+)$/.exec(location.hash);
    if (m) widokLekcji(+m[1]);
    else if (f) widokFiszek(slowkaLekcji(+f[1]), 'Słówka z lekcji ' + f[1], '#lekcja/' + f[1]);
    else if (location.hash === '#slowka') widokFiszek(doPowtorki(), 'Powtórka słówek', '#');
    else widokPlanu();
  }
  function uruchomKurs() {
    L = window.NiemLekcje; B = window.NiemBloki;
    zapisz();
    window.addEventListener('hashchange', trasa);
    trasa();
  }

  // --- klucz: ten sam co w pozostałych kursach, zapisany na tym urządzeniu ---
  function czytajKlucz() { try { return localStorage.getItem(KLUCZ_SZYFRU) || ''; } catch (e) { return ''; } }
  function zapiszKlucz(k) { try { localStorage.setItem(KLUCZ_SZYFRU, k); } catch (e) { /* zostanie do zamknięcia karty */ } }
  function usunKlucz() { try { localStorage.removeItem(KLUCZ_SZYFRU); } catch (e) { /* nie ma czego usuwać */ } }
  function kluczZTekstu(t) {
    t = (t || '').trim();
    var m = /klucz=([A-Za-z0-9_-]+)/.exec(t);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{40,}$/.test(t) ? t : '';
  }
  function rozszyfruj(klucz) {
    return crypto.subtle.importKey('raw', zBase64(klucz), 'AES-GCM', false, ['decrypt']).then(function (ck) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: zBase64(window.KursSzyfr.iv) }, ck, zBase64(window.KursSzyfr.dane));
    }).then(function (b) {
      // Tekst uwierzytelnia AES-GCM: bez klucza nikt nie podmieni kodu na inny.
      new Function(new TextDecoder().decode(b))();
    });
  }
  function widokKlucza(komunikat) {
    wyczysc(app);
    var pole = el('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Link z kluczem', rows: 3 });
    function zatwierdz() {
      var k = kluczZTekstu(pole.value);
      if (!k) { widokKlucza('❌ To nie wygląda na link z kluczem.'); return; }
      pole.value = '';
      odblokuj(k);
    }
    app.appendChild(el('p', {}, el('a', { href: '../index.html', text: '← Centrum Nauki Taty' })));
    app.appendChild(el('div', { class: 'karta' },
      el('h3', { text: '🔒 Ten kurs jest zaszyfrowany' }),
      el('p', { text: 'To urządzenie nie ma jeszcze klucza. Zeskanuj kod QR albo wklej tutaj link z kluczem. Wystarczy zrobić to raz.' }),
      komunikat ? el('div', { class: 'msg zle', text: komunikat, style: 'margin-bottom:10px' }) : null,
      pole,
      el('div', { class: 'przyciski' }, el('button', { class: 'g', text: 'Odblokuj', onclick: zatwierdz }))));
  }
  function odblokuj(klucz) {
    rozszyfruj(klucz).then(function () {
      zapiszKlucz(klucz);
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      uruchomKurs();
    }, function () {
      usunKlucz();
      widokKlucza('❌ Ten klucz nie otwiera kursu. Zeskanuj kod QR jeszcze raz.');
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () { /* bez trybu offline kurs nadal działa */ });
  }
  var zAdresu = /^#klucz=/.test(location.hash) ? kluczZTekstu(location.hash) : '';
  if (/^#klucz=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  if (window.NiemLekcje) uruchomKurs();
  else if (zAdresu || czytajKlucz()) odblokuj(zAdresu || czytajKlucz());
  else widokKlucza();
})();
