import { state, viewport } from './state.js';
// card.js is a circular peer — imports are only used inside functions, never at eval time
import { bringToFront, selectCard } from './card.js';

export function refreshIndex() {
  const container = document.getElementById('imgIndex');
  container.innerHTML = '';
  state.cards.forEach((data, id) => {
    const chip = document.createElement('span');
    chip.className      = 'idx-chip';
    chip.dataset.cardId = id;
    chip.textContent    = data.name;
    chip.title          = data.name;
    chip.addEventListener('click', () => focusCard(id));
    container.appendChild(chip);
  });
  setActiveChip(state.selectedId);
}

export function setActiveChip(id) {
  document.querySelectorAll('.idx-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cardId === id);
  });
}

export function focusCard(id) {
  const card = document.querySelector(`.img-card[data-card-id="${id}"]`);
  if (!card) return;
  const data = state.cards.get(id);
  if (data) bringToFront(card, data);
  selectCard(id);
  const px = parseInt(card.style.left, 10) || 0;
  const py = parseInt(card.style.top,  10) || 0;
  viewport.scrollTo({
    left: px - (viewport.clientWidth  - card.offsetWidth)  / 2,
    top:  py - (viewport.clientHeight - card.offsetHeight) / 2,
    behavior: 'smooth',
  });
}
