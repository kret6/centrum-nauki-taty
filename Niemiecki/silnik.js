// Sprawdzanie odpowiedzi w kursie niemieckiego. Działa w przeglądarce i w testach.
(function (g) {
  function czysc(t) { return String(t === undefined || t === null ? '' : t).trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, ''); }
  // Na polskiej klawiaturze telefonu trudno o umlaut, więc „ae” i brak wielkiej litery nie blokują zaliczenia.
  function zloz(t) {
    return czysc(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  }
  function sprawdzLuke(odp, dobre) {
    var o = czysc(odp);
    if (!o) return { ok: false, powod: 'Wpisz odpowiedź.' };
    for (var i = 0; i < dobre.length; i++) if (czysc(dobre[i]) === o) return { ok: true };
    for (var j = 0; j < dobre.length; j++) {
      if (zloz(dobre[j]) === zloz(o)) return { ok: true, uwaga: 'Zaliczone, ale pisze się: ' + dobre[j] };
    }
    return { ok: false, powod: 'Jeszcze nie.' };
  }
  // Tekstu pisanego nie da się uczciwie ocenić automatem. Sprawdzamy tylko, czy są w nim wymagane elementy.
  function sprawdzElementy(tekst, elementy) {
    return (elementy || []).map(function (e) {
      return { opis: e.opis, jest: new RegExp(e.re, 'i').test(tekst || '') };
    });
  }
  // Nagranie: kolejność fragmentów budowana z lekcji. Ten sam układ widzą test i generator.
  function skryptNagrania(l) {
    var w = [];
    w.push(['N', 'Lektion ' + l.nr + '. ' + l.tytulDe + '.']);
    w.push(['N', l.wstepDe]);
    w.push(['P', 300]);
    l.rozmowa.forEach(function (r) { w.push([r[0], r[1]]); });
    w.push(['P', 900]);
    w.push(['L', 'Teraz ty. Usłyszysz zdanie po polsku. Powiedz je na głos po niemiecku, a potem powtórz za lektorem.']);
    w.push(['P', 500]);
    l.dril.forEach(function (d) {
      w.push(['L', d.pl]);
      w.push(['PAUZA_NA', d.de]);
      w.push(['K', d.de]);
      w.push(['PAUZA_NA', d.de]);
      w.push(['K', d.de]);
      w.push(['P', 600]);
    });
    w.push(['L', 'Koniec nagrania. Zadania czekają w aplikacji, gdy będziesz mieć chwilę.']);
    return w;
  }
  g.KursNiem = { czysc: czysc, zloz: zloz, sprawdzLuke: sprawdzLuke, sprawdzElementy: sprawdzElementy, skryptNagrania: skryptNagrania };
})(typeof globalThis !== 'undefined' ? globalThis : window);
