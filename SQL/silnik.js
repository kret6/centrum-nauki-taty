// Uruchamianie i sprawdzanie zadań. Bez interfejsu, żeby te same funkcje działały w testach.
(function (g) {
  function bezKomentarzy(sql) {
    return String(sql).replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  }

  function ostatni(db, sql) {
    var r = db.exec(sql);
    return r.length ? r[r.length - 1] : null;
  }

  // Każde uruchomienie cofa zmiany, więc baza ćwiczeniowa zawsze wraca do stanu początkowego.
  function piaskownica(db, fn) {
    db.run('BEGIN');
    try {
      return fn();
    } finally {
      try { db.run('ROLLBACK'); } catch (e) { piaskownica.zepsuta = true; }
    }
  }

  function uruchom(db, sql) {
    return piaskownica(db, function () {
      var t = Date.now();
      var wynik = ostatni(db, sql);
      return { wynik: wynik, ms: Date.now() - t };
    });
  }

  function plan(db, sql) {
    var r = ostatni(db, 'EXPLAIN QUERY PLAN ' + sql);
    if (!r) return '';
    var i = r.columns.indexOf('detail');
    return r.values.map(function (w) { return w[i]; }).join('\n');
  }

  function porownajWartosci(a, b) {
    if (a === null || b === null) return a === b ? 0 : (a === null ? -1 : 1);
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function porownajWiersze(x, y) {
    for (var i = 0; i < x.length; i++) {
      var c = porownajWartosci(x[i], y[i]);
      if (c) return c;
    }
    return 0;
  }
  function rowne(a, b) {
    if (a === null || b === null) return a === b;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.02;
    return String(a) === String(b);
  }
  function pokaz(w) { return w === null ? 'NULL' : String(w); }

  function pierwszaRoznica(a, b, kolumny) {
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < a[i].length; j++) {
        if (!rowne(a[i][j], b[i][j])) return { w: i, k: j, jest: a[i][j], ma: b[i][j], kol: kolumny[j] };
      }
    }
    return null;
  }

  function porownaj(jest, wzor, porzadek) {
    var a = jest ? jest.values : [], b = wzor ? wzor.values : [];
    if (!jest && wzor && wzor.values.length) return { ok: false, powod: 'Zapytanie nie zwróciło żadnego wiersza, a powinno ich być ' + wzor.values.length + '.' };
    var kolA = jest ? jest.columns.length : 0, kolB = wzor ? wzor.columns.length : 0;
    if (kolA !== kolB) return { ok: false, powod: 'Liczba kolumn: masz ' + kolA + ', powinno być ' + kolB + ' (' + wzor.columns.join(', ') + ').' };
    if (a.length !== b.length) return { ok: false, powod: 'Liczba wierszy: masz ' + a.length + ', powinno być ' + b.length + '.' };
    var sa = a.slice().sort(porownajWiersze), sb = b.slice().sort(porownajWiersze);
    var r = pierwszaRoznica(sa, sb, wzor.columns);
    if (r) return { ok: false, powod: 'Inne dane w kolumnie „' + r.kol + '”, np. masz ' + pokaz(r.jest) + ', a powinno być ' + pokaz(r.ma) + '. Sprawdź warunki i kolejność kolumn.' };
    if (porzadek && pierwszaRoznica(a, b, wzor.columns)) return { ok: false, powod: 'Dane się zgadzają, ale kolejność wierszy nie. Sprawdź ORDER BY.' };
    return { ok: true, powod: '' };
  }

  function wzorzec(db, z) {
    if (z.typ === 'plan') return null;
    return piaskownica(db, function () {
      if (z.przygotuj) db.run(z.przygotuj);
      return ostatni(db, z.rozw);
    });
  }

  // Zwraca { ok, powod, wynik, plan, ms }. Błąd SQL wraca jako ok:false, a nie jako wyjątek.
  function sprawdz(db, z, sql, wzor) {
    var tekst = bezKomentarzy(sql);
    if (!tekst.trim()) return { ok: false, powod: 'Najpierw wpisz zapytanie.' };
    try {
      return piaskownica(db, function () {
        var t = Date.now();
        if (z.przygotuj) db.run(z.przygotuj);
        var wynik = ostatni(db, sql);
        var ms = Date.now() - t, odp = { ok: true, powod: '', wynik: wynik, ms: ms };

        if (z.wymaga && !new RegExp(z.wymaga, 'i').test(tekst)) {
          odp.ok = false; odp.powod = z.wymagaOpis || 'To zadanie wymaga innej konstrukcji.'; return odp;
        }
        if (z.typ === 'plan') {
          odp.plan = plan(db, z.zapytanie);
          if (!new RegExp(z.regex).test(odp.plan)) { odp.ok = false; odp.powod = z.regexOpis || 'Plan nadal nie wygląda tak, jak trzeba.'; }
          return odp;
        }
        var wz = wzor !== undefined ? wzor : null;
        if (!wz) throw new Error('Brak wzorca zadania');
        var cmp = porownaj(wynik, wz, z.porzadek);
        if (!cmp.ok) { odp.ok = false; odp.powod = cmp.powod; return odp; }
        if (z.typ === 'sarg') {
          odp.plan = plan(db, tekst.trim().replace(/;\s*$/, ''));
          if (!new RegExp(z.regex).test(odp.plan)) { odp.ok = false; odp.powod = z.regexOpis || 'Wynik jest dobry, ale plan nadal nie korzysta z indeksu.'; }
        }
        return odp;
      });
    } catch (e) {
      return { ok: false, powod: 'Błąd SQL: ' + e.message, blad: true };
    }
  }

  g.KursSilnik = { uruchom: uruchom, sprawdz: sprawdz, wzorzec: wzorzec, plan: plan, porownaj: porownaj, piaskownica: piaskownica };
})(typeof window !== 'undefined' ? window : globalThis);
