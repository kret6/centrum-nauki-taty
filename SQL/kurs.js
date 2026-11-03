// Interfejs kursu: plan, lekcje, zadania i postęp zapisany w przeglądarce.
(function () {
  var KLUCZ = 'centrum_taty_sql_postep';
  var KLUCZ_SZYFRU = 'centrum_taty_klucz';
  // Lekcje i dane pojawiają się dopiero po rozszyfrowaniu (albo od razu w wersji źródłowej).
  var L, B, D, S = window.KursSilnik;
  var app = document.getElementById('aplikacja');
  var SQL = null, db = null, wzorce = {};

  function wczytaj() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(KLUCZ)); } catch (e) { p = null; }
    p = p || {};
    p.zadania = p.zadania || {}; p.lekcje = p.lekcje || {}; p.kod = p.kod || {};
    return p;
  }
  var stan = wczytaj();
  function zapisz() { if (L) stan.razem = L.length; try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); } catch (e) { /* postęp zostanie tylko do zamknięcia karty */ } }
  function dzis() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // el('div', {class:'x', html:'...', text:'...', onclick:fn}, dziecko1, dziecko2)
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

  function nowaBaza() {
    if (db) db.close();
    db = new SQL.Database();
    D.zbuduj(db);
    S.piaskownica.zepsuta = false;
  }
  function napraw() { if (S.piaskownica.zepsuta) nowaBaza(); }

  function nastepna() {
    for (var i = 0; i < L.length; i++) if (!stan.lekcje[L[i].nr]) return L[i];
    return null;
  }
  function robionaDzis() {
    for (var nr in stan.lekcje) if (stan.lekcje[nr] === dzis()) return true;
    return false;
  }
  function zadanieId(l, i) { return l.nr + '.' + (i + 1); }

  // --- wyniki ---
  function tabela(w) {
    var box = el('div', { class: 'wynik' });
    if (!w) { box.appendChild(el('div', { class: 'msg info', text: 'Zapytanie nie zwróciło wierszy.' })); return box; }
    var t = el('table'), h = el('tr');
    w.columns.forEach(function (c) { h.appendChild(el('th', { text: c })); });
    t.appendChild(el('thead', {}, h));
    var b = el('tbody'), MAX = 50;
    w.values.slice(0, MAX).forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (v) { tr.appendChild(v === null ? el('td', { class: 'n', text: 'NULL' }) : el('td', { text: String(v) })); });
      b.appendChild(tr);
    });
    t.appendChild(b); box.appendChild(t);
    box.appendChild(el('div', { class: 'mala', text: 'Wierszy: ' + w.values.length + (w.values.length > MAX ? ' (pokazuję pierwsze ' + MAX + ')' : '') }));
    return box;
  }
  function wyczysc(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function liczac(miejsce, fn) {
    wyczysc(miejsce);
    miejsce.appendChild(el('div', { class: 'msg info', text: '⏳ Liczę…' }));
    setTimeout(function () { wyczysc(miejsce); fn(); napraw(); }, 20);
  }

  function edytor(wartosc, akcja) {
    var t = el('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Zapytanie SQL' });
    t.value = wartosc || '';
    t.rows = Math.max(5, t.value.split('\n').length + 1);
    t.onkeydown = function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); akcja(); } };
    return t;
  }

  // Pasek pod polem na telefon: słowa kluczowe i znaki, które na klawiaturze są ukryte.
  var SKROTY = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NULL', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'COUNT(', 'SUM(', 'AS', 'WITH', '*', '=', '<', '>', '\'', ',', '(', ')', '.', '_', ';'];
  function skroty(t) {
    var p = el('div', { class: 'skroty', 'aria-label': 'Wstawianie fragmentów SQL' });
    SKROTY.forEach(function (s) {
      var slowo = /^[A-Z ]+$/.test(s);
      var b = el('button', { type: 'button', text: s, onclick: function () {
        var a = t.selectionStart, poprzedni = t.value.charAt(a - 1);
        var wstaw = slowo ? ((a > 0 && !/\s/.test(poprzedni) ? ' ' : '') + s + ' ') : s;
        t.setRangeText(wstaw, a, t.selectionEnd, 'end');
        t.focus();
      } });
      // klawiatura ma zostać otwarta po dotknięciu przycisku
      b.onpointerdown = function (e) { e.preventDefault(); };
      b.onmousedown = function (e) { e.preventDefault(); };
      p.appendChild(b);
    });
    return p;
  }

  // --- plan kursu ---
  function widokPlanu() {
    wyczysc(app);
    window.scrollTo(0, 0);
    var ile = Object.keys(stan.lekcje).length, nast = nastepna(), dzisiaj = robionaDzis();
    app.appendChild(el('p', {}, el('a', { href: '../index.html', text: '← Centrum Nauki Taty' })));
    app.appendChild(el('h1', { text: '🗄️ Kurs SQL' }));
    app.appendChild(el('p', { class: 'mala', text: L.length + ' lekcji po kilkanaście minut. Każda ma krótką teorię i zadania sprawdzane od razu, na bazie działającej w tej przeglądarce. Dane są fikcyjne, a każda próba cofa się sama.' }));

    var k = el('div', { class: 'karta dzis' });
    if (!nast) {
      k.appendChild(el('h3', { text: '🎉 Kurs ukończony' }));
      k.appendChild(el('p', { text: 'Wszystkie lekcje są zrobione. Możesz wracać do każdej z nich.' }));
    } else if (dzisiaj) {
      k.appendChild(el('h3', { text: '✅ Dzisiejsza lekcja jest zrobiona' }));
      k.appendChild(el('p', { text: 'Jutro: lekcja ' + nast.nr + '. ' + nast.tytul + '.' }));
      k.appendChild(el('div', { class: 'przyciski' }, el('a', { class: 'btn', href: '#lekcja/' + nast.nr, text: 'Mam ochotę już dziś' })));
    } else {
      k.appendChild(el('div', { class: 'mala', text: 'Dzisiaj, około 15 minut' }));
      k.appendChild(el('h3', { text: 'Lekcja ' + nast.nr + '. ' + nast.tytul }));
      k.appendChild(el('p', { text: nast.cel }));
      k.appendChild(el('div', { class: 'przyciski' }, el('a', { class: 'btn g', href: '#lekcja/' + nast.nr, text: 'Zaczynam' })));
    }
    k.appendChild(el('div', { class: 'pasek', role: 'img', 'aria-label': 'Postęp: ' + ile + ' z ' + L.length }, el('i', { style: 'width:' + Math.round(100 * ile / L.length) + '%' })));
    k.appendChild(el('div', { class: 'mala', text: 'Zrobione: ' + ile + ' z ' + L.length }));
    app.appendChild(k);

    B.forEach(function (blok, nrB) {
      app.appendChild(el('h2', { text: blok.nazwa }));
      app.appendChild(el('p', { class: 'mala', text: blok.opis }));
      var lista = el('div', { class: 'karta lista' });
      L.filter(function (l) { return l.blok === nrB; }).forEach(function (l) {
        var zrob = !!stan.lekcje[l.nr], akt = nast && nast.nr === l.nr;
        var a = el('a', { href: '#lekcja/' + l.nr, class: akt ? 'aktualna' : '' });
        a.appendChild(el('span', { class: 'st', text: zrob ? '✅ zrobiona' : akt ? '▶ następna' : '○ przed Tobą' }));
        a.appendChild(el('span', { text: l.nr + '. ' + l.tytul }));
        lista.appendChild(a);
      });
      app.appendChild(lista);
    });

    if (ile) {
      app.appendChild(el('p', { class: 'mala', style: 'margin-top:28px' }, el('a', { href: '#', text: 'Wyzeruj postęp', onclick: function (e) {
        e.preventDefault();
        if (confirm('Na pewno wyzerować cały postęp kursu?')) { stan = { zadania: {}, lekcje: {}, kod: {} }; zapisz(); widokPlanu(); }
      } })));
    }
  }

  // --- zadania ---
  function zaliczone(l, i, kartaStan) {
    stan.zadania[zadanieId(l, i)] = true;
    kartaStan.textContent = '✅ zaliczone'; kartaStan.className = 'stan ok';
    var wszystkie = l.zadania.every(function (_, j) { return stan.zadania[zadanieId(l, j)]; });
    if (wszystkie && !stan.lekcje[l.nr]) stan.lekcje[l.nr] = dzis();
    zapisz();
    odswiezStopke(l);
  }

  function kartaQuiz(l, z, i) {
    var id = zadanieId(l, i), sw = stan.zadania[id];
    var st = el('span', { class: 'stan' + (sw ? ' ok' : ''), text: sw ? '✅ zaliczone' : '○ do zrobienia' });
    var k = el('div', { class: 'karta' }, el('div', { class: 'glowa' }, el('h3', { text: 'Zadanie ' + (i + 1) }), st), el('div', { html: z.tresc }));
    var m = el('div');
    // odpowiedzi w przypadkowej kolejności, inaczej dobra byłaby zawsze w tym samym miejscu
    z.opcje.map(function (t, n) { return { t: t, n: n, r: Math.random() }; }).sort(function (a, b) { return a.r - b.r; }).forEach(function (o) {
      k.appendChild(el('button', { class: 'opcja', text: o.t, onclick: function () {
        wyczysc(m);
        if (o.n === z.poprawna) { m.appendChild(el('div', { class: 'msg ok', html: '✅ Dobrze. ' + z.wyjasnienie })); zaliczone(l, i, st); }
        else m.appendChild(el('div', { class: 'msg zle', text: '❌ Nie, spróbuj jeszcze raz.' }));
      } }));
    });
    k.appendChild(m);
    return k;
  }

  function kartaZadania(l, z, i) {
    var id = zadanieId(l, i), sw = stan.zadania[id];
    var st = el('span', { class: 'stan' + (sw ? ' ok' : ''), text: sw ? '✅ zaliczone' : '○ do zrobienia' });
    var wy = el('div');
    function wzorcowy() {
      if (z.typ === 'plan') return null;
      if (!(id in wzorce)) wzorce[id] = S.wzorzec(db, z);
      return wzorce[id];
    }
    function sprawdz() {
      stan.kod[id] = t.value; zapisz();
      liczac(wy, function () {
        var r = S.sprawdz(db, z, t.value, z.typ === 'plan' ? null : wzorcowy());
        wy.appendChild(el('div', { class: 'msg ' + (r.ok ? 'ok' : 'zle'), text: (r.ok ? '✅ Dobrze!' : '❌ Jeszcze nie. ' + r.powod) + (r.ok && r.ms !== undefined ? ' Czas: ' + r.ms + ' ms.' : '') }));
        if (r.plan) wy.appendChild(el('pre', { class: 'plan', text: 'Plan: ' + r.plan }));
        if (!r.blad && r.wynik && z.typ !== 'plan') wy.appendChild(tabela(r.wynik));
        if (r.ok) zaliczone(l, i, st);
      });
    }
    var t = edytor(stan.kod[id] || '', sprawdz);
    var pod = el('div');
    var k = el('div', { class: 'karta' }, el('div', { class: 'glowa' }, el('h3', { text: 'Zadanie ' + (i + 1) }), st), el('div', { html: z.tresc }), el('div', { style: 'height:10px' }), t, skroty(t));
    k.appendChild(el('div', { class: 'przyciski' },
      el('button', { class: 'g', text: 'Sprawdź', onclick: sprawdz }),
      el('button', { text: 'Podpowiedź', onclick: function () { wyczysc(pod); pod.appendChild(el('div', { class: 'msg info', text: '💡 ' + z.podpowiedz })); } }),
      el('button', { text: 'Pokaż rozwiązanie', onclick: function () { wyczysc(pod); pod.appendChild(el('pre', { class: 'kod', text: z.rozw })); } })
    ));
    k.appendChild(el('div', { class: 'mala tylko-pc', style: 'margin-top:6px', text: 'Skrót: Ctrl + Enter' }));
    k.appendChild(pod);
    if (z.typ !== 'plan') {
      var dziury = el('div');
      var det = el('details', {}, el('summary', { text: 'Jak ma wyglądać wynik' }), dziury);
      det.ontoggle = function () {
        if (det.open && !dziury.firstChild) liczac(dziury, function () {
          var w = wzorcowy();
          dziury.appendChild(tabela(w ? { columns: w.columns, values: w.values.slice(0, 3) } : null));
          dziury.appendChild(el('div', { class: 'mala', text: 'Pierwsze wiersze. Razem powinno być: ' + (w ? w.values.length : 0) + '.' }));
        });
      };
      k.appendChild(det);
    }
    k.appendChild(wy);
    return k;
  }

  var stopka = null;
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

  function widokLekcji(nr) {
    var l = L[nr - 1];
    if (!l) { location.hash = ''; return; }
    wyczysc(app);
    window.scrollTo(0, 0);
    app.appendChild(el('p', {}, el('a', { href: '#', text: '← Plan kursu' })));
    app.appendChild(el('div', { class: 'mala', text: 'Lekcja ' + l.nr + ' z ' + L.length + ' · ' + B[l.blok].nazwa }));
    app.appendChild(el('h1', { text: l.tytul }));
    app.appendChild(el('p', { text: l.cel }));
    app.appendChild(el('div', { class: 'karta', html: l.teoria }));

    l.przyklady.forEach(function (p) {
      var wy = el('div');
      function odpal() {
        liczac(wy, function () {
          try {
            var r = S.uruchom(db, t.value);
            wy.appendChild(el('div', { class: 'mala', text: 'Czas: ' + r.ms + ' ms' }));
            wy.appendChild(tabela(r.wynik));
          } catch (e) { wy.appendChild(el('div', { class: 'msg zle', text: '❌ Błąd SQL: ' + e.message })); }
        });
      }
      var t = edytor(p.sql, odpal);
      app.appendChild(el('div', { class: 'karta' }, el('h3', { text: 'Przykład: ' + p.opis }), t, skroty(t),
        el('div', { class: 'przyciski' }, el('button', { class: 'g', text: 'Uruchom', onclick: odpal })), wy));
    });

    var schemat = el('div');
    D.schemat.forEach(function (s) {
      schemat.appendChild(el('p', { class: 'mala', html: '<b>' + s[0] + '</b> (' + s[2] + ')<br><code>' + s[1] + '</code>' }));
    });
    app.appendChild(el('details', { class: 'karta' }, el('summary', { text: '🗂️ Tabele w bazie' }), schemat));

    app.appendChild(el('h2', { text: 'Zadania' }));
    l.zadania.forEach(function (z, i) { app.appendChild(z.typ === 'quiz' ? kartaQuiz(l, z, i) : kartaZadania(l, z, i)); });

    app.appendChild(el('div', { class: 'karta wpracy' }, el('h3', { text: '💼 W pracy' }), el('div', { html: l.wPracy })));
    stopka = el('div');
    app.appendChild(stopka);
    odswiezStopke(l);
  }

  function trasa() {
    var m = /^#lekcja\/(\d+)$/.exec(location.hash);
    if (m) widokLekcji(+m[1]); else widokPlanu();
  }

  function zBase64(s) {
    var z = atob(s.replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(z.length);
    for (var i = 0; i < z.length; i++) b[i] = z.charCodeAt(i);
    return b;
  }

  function uruchomKurs() {
    L = window.KursLekcje; B = window.KursBloki; D = window.KursDane;
    return initSqlJs({ wasmBinary: zBase64(window.KursWasmBase64) }).then(function (s) {
      SQL = s;
      nowaBaza();
      zapisz();
      window.addEventListener('hashchange', trasa);
      trasa();
    }).catch(function (e) {
      wyczysc(app);
      app.appendChild(el('p', { class: 'karta', text: '❌ Nie udało się uruchomić kursu: ' + e.message }));
    });
  }

  // --- klucz: nigdy w repozytorium, tylko w pamięci tego urządzenia ---
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
      return uruchomKurs();
    }, function () {
      usunKlucz();
      widokKlucza('❌ Ten klucz nie otwiera kursu. Zeskanuj kod QR jeszcze raz.');
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () { /* bez trybu offline kurs nadal działa */ });
  }

  var zAdresu = /^#klucz=/.test(location.hash) ? kluczZTekstu(location.hash) : '';
  // klucz nie zostaje w pasku adresu ani w historii przeglądarki
  if (/^#klucz=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  if (window.KursLekcje) uruchomKurs();
  else if (zAdresu || czytajKlucz()) odblokuj(zAdresu || czytajKlucz());
  else widokKlucza();
})();
