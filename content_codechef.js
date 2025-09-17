// content_codechef.js
(function() {
  const contests = [];
  const upcomingTable = Array.from(document.querySelectorAll('table')).find(table =>
    table.querySelector('th') && table.querySelector('th').textContent.includes('Upcoming Contests')
  );
  if (upcomingTable) {
    upcomingTable.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        contests.push({
          event: cells[1].textContent.trim(),
          start: cells[2].textContent.trim(),
          end: cells[3].textContent.trim(),
          href: `https://www.codechef.com/${cells[0].textContent.trim()}`
        });
      }
    });
  }
  chrome.storage.local.set({ codechefContests: contests });
})();
