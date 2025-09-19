(function () {
  const board = document.querySelector('.board-columns');
  if (!board) {
    return;
  }

  const applyColumnClasses = () => {
    board.querySelectorAll(':scope > div').forEach(col => {
      col.classList.add('kanban-column');
    });
  };

  const normalizePriorityBadges = () => {
    board.querySelectorAll('span[class^="priority-"]').forEach(span => {
      const cls = Array.from(span.classList).find(c => c.startsWith('priority-'));
      if (!cls) {
        return;
      }
      const label = cls.slice('priority-'.length).replace(/-/g, ' ');
      span.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    });
  };

  applyColumnClasses();
  normalizePriorityBadges();

  board.addEventListener('wheel', event => {
    if (event.defaultPrevented || event.ctrlKey) {
      return;
    }
    const dominantAxis = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    if (!dominantAxis) {
      return;
    }
    event.preventDefault();
    board.scrollLeft += event.deltaY;
  }, { passive: false });

  const observer = new MutationObserver(() => {
    applyColumnClasses();
    normalizePriorityBadges();
  });

  observer.observe(board, { childList: true, subtree: true });
})();