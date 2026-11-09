// Sprawdzanie odpowiedzi w kursie BA. Działa w przeglądarce i w testach.
(function (g) {
  // Telefon wstawia cudzysłowy drukarskie, a a wzorce w zadaniach używają prostych.
  function proste(t) { return String(t === undefined || t === null ? '' : t).replace(/[„”“]/g, '"').replace(/[‚’‘]/g, "'"); }
  function czysc(t) { return proste(t).trim().replace(/\s+/g, ' ').replace(/[;.]+$/, ''); }
  function sprawdzLuke(odp, dobre) {
    var o = czysc(odp);
    if (!o) return { ok: false, powod: 'Wpisz odpowiedź.' };
    for (var i = 0; i < dobre.length; i++) if (czysc(dobre[i]) === o) return { ok: true };
    // Wielkość liter nie blokuje zaliczenia, bo słowa kluczowe (Given, Then) i nazwy pojęć można pisać różnie.
    for (var j = 0; j < dobre.length; j++) if (czysc(dobre[j]).toLowerCase() === o.toLowerCase()) return { ok: true, uwaga: 'Zaliczone, a przyjęty zapis to: ' + dobre[j] };
    return { ok: false, powod: 'Jeszcze nie.' };
  }
  // Tekstu pisanego automat nie oceni. Sprawdzamy tylko, czy są w nim wymagane elementy.
  function sprawdzElementy(tekst, elementy) {
    return (elementy || []).map(function (e) { return { opis: e.opis, jest: new RegExp(e.re, 'i').test(tekst || '') }; });
  }
  g.KursBa = { czysc: czysc, sprawdzLuke: sprawdzLuke, sprawdzElementy: sprawdzElementy };
})(typeof globalThis !== 'undefined' ? globalThis : window);
