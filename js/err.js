/* 404 only — reveals one of three variants at random; the re-roll button
   always picks a DIFFERENT one, so pressing it visibly does something.
   All three ship in the HTML, so there is no flash and no second request. */
(function () {
  'use strict';
  var cards = [].slice.call(document.querySelectorAll('.err-card'));
  var shown = -1;

  // Show the path the visitor actually asked for. textContent, never innerHTML.
  try {
    var p = document.querySelector('[data-path]');
    if (p && location.pathname && location.pathname !== '/404.html') p.textContent = location.pathname.slice(0, 60);
  } catch (e) {}

  function roll(force) {
    var i;
    do { i = Math.floor(Math.random() * cards.length); }
    while (cards.length > 1 && force && i === shown);
    cards.forEach(function (c, n) {
      c.hidden = n !== i;
      if (n === i) { c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); }
    });
    shown = i;
  }
  roll(false);
  var b = document.getElementById('reroll');
  if (b) b.addEventListener('click', function () { roll(true); });
})();
