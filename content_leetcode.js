// content_leetcode.js
(function() {
  const contests = [];
  document.querySelectorAll('.contest-card').forEach(card => {
    const nameElem = card.querySelector('.contest-title');
    const timeElem = card.querySelector('.contest-date');
    const linkElem = card.querySelector('a');
    if (nameElem && timeElem && linkElem) {
      contests.push({
        event: nameElem.textContent.trim(),
        start: timeElem.textContent.trim(),
        href: 'https://leetcode.com' + linkElem.getAttribute('href')
      });
    }
  });
  chrome.storage.local.set({ leetcodeContests: contests });
})();
