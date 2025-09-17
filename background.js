// Listen for messages from popup.js to fetch contests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContests") {
    chrome.storage.sync.get(["selectedPlatforms"], async (res) => {
      const selectedPlatforms = res.selectedPlatforms || [];
      let leetcodeHtml = "", codechefHtml = "", codeforcesContests = [];
      // Helper for fetch with timeout
      async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 8000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(resource, { signal: controller.signal });
          clearTimeout(id);
          return response;
        } catch (e) {
          clearTimeout(id);
          return null;
        }
      }
      if (selectedPlatforms.includes('leetcode.com')) {
        try {
          const response = await fetchWithTimeout('https://YOUR_PROXY_URL/leetcode');
          if (response) leetcodeHtml = await response.text();
        } catch {}
      }
      if (selectedPlatforms.includes('codechef.com')) {
        try {
          const response = await fetchWithTimeout('https://YOUR_PROXY_URL/codechef');
          if (response) codechefHtml = await response.text();
        } catch {}
      }
      if (selectedPlatforms.includes('codeforces.com')) {
        try {
          const response = await fetch('https://YOUR_PROXY_URL/codeforces');
          const data = await response.json();
          if (data.status === 'OK') {
            codeforcesContests = data.result.filter(c => c.phase === 'BEFORE').map(c => ({
              event: c.name,
              resource: 'codeforces.com',
              start: new Date(c.startTimeSeconds * 1000).toISOString(),
              end: new Date((c.startTimeSeconds + c.durationSeconds) * 1000).toISOString(),
              duration_seconds: c.durationSeconds,
              href: `https://codeforces.com/contests/${c.id}`
            }));
          }
        } catch {}
      }
      sendResponse({ leetcodeHtml, codechefHtml, codeforcesContests });
    });
    return true;
  }
});


// Helper to build clist.by API URL with user credentials

// Helper to get the next morning at a specific hour and minute
function getNextMorningTime(hour, minute) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Contest Notifier installed");
  chrome.alarms.create("morningNotify", {
    when: getNextMorningTime(8, 0),
    periodInMinutes: 24 * 60
  });
  chrome.alarms.create("hourlyCheck", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "morningNotify") {
    notifyMorningContests();
  }
  if (alarm.name === "hourlyCheck") {
    notifyUpcomingContests();
  }
});

// Fetch contests from all platforms
async function fetchAllContests(selectedPlatforms) {
  // LeetCode
  async function fetchLeetCodeContests() {
    try {
      const response = await fetch('https://YOUR_PROXY_URL/leetcode');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const contestCards = doc.querySelectorAll('.contest-card');
      let contests = [];
      contestCards.forEach(card => {
        const nameElem = card.querySelector('.contest-title');
        const timeElem = card.querySelector('.contest-date');
        const linkElem = card.querySelector('a');
        if (nameElem && timeElem && linkElem) {
          const name = nameElem.textContent.trim();
          const time = timeElem.textContent.trim();
          const href = 'https://leetcode.com' + linkElem.getAttribute('href');
          contests.push({
            event: name,
            resource: 'leetcode.com',
            start: new Date(time).toISOString(),
            end: new Date(new Date(time).getTime() + 90 * 60 * 1000).toISOString(),
            duration_seconds: 90 * 60,
            href: href
          });
        }
      });
      return contests;
    } catch (err) {
      return [];
    }
  }
  // Codeforces
  async function fetchCodeforcesContests() {
    try {
      const response = await fetch('https://YOUR_PROXY_URL/codeforces');
      const data = await response.json();
      if (data.status !== 'OK') return [];
      const contests = data.result.filter(c => c.phase === 'BEFORE').map(c => ({
        event: c.name,
        resource: 'codeforces.com',
        start: new Date(c.startTimeSeconds * 1000).toISOString(),
        end: new Date((c.startTimeSeconds + c.durationSeconds) * 1000).toISOString(),
        duration_seconds: c.durationSeconds,
        href: `https://codeforces.com/contests/${c.id}`
      }));
      return contests;
    } catch (err) {
      return [];
    }
  }
  // CodeChef
  async function fetchCodeChefContests() {
    try {
      const response = await fetch('https://YOUR_PROXY_URL/codechef');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let contests = [];
      const upcomingTable = Array.from(doc.querySelectorAll('table')).find(table => {
        return table.querySelector('th') && table.querySelector('th').textContent.includes('Upcoming Contests');
      });
      if (upcomingTable) {
        const rows = upcomingTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const name = cells[1].textContent.trim();
            const code = cells[0].textContent.trim();
            const start = cells[2].textContent.trim();
            const end = cells[3].textContent.trim();
            contests.push({
              event: name,
              resource: 'codechef.com',
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
              duration_seconds: (new Date(end) - new Date(start)) / 1000,
              href: `https://www.codechef.com/${code}`
            });
          }
        });
      }
      return contests;
    } catch (err) {
      return [];
    }
  }
  // Fetch all in parallel
  const [leetcode, codeforces, codechef] = await Promise.all([
    selectedPlatforms.includes('leetcode.com') ? fetchLeetCodeContests() : [],
    selectedPlatforms.includes('codeforces.com') ? fetchCodeforcesContests() : [],
    selectedPlatforms.includes('codechef.com') ? fetchCodeChefContests() : []
  ]);
  return [...leetcode, ...codeforces, ...codechef];
}

// Notify in the morning about contests happening today
async function notifyMorningContests() {
  chrome.storage.sync.get(["selectedPlatforms", "notifyContests"], async (res) => {
    const selectedPlatforms = res.selectedPlatforms || [];
    const notifyContests = res.notifyContests || {};
    const contests = await fetchAllContests(selectedPlatforms);
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const contestsNext7Days = contests.filter(c => {
      const start = new Date(c.start);
      const contestId = encodeURIComponent(c.event + c.start + c.resource);
      return start > now && start < sevenDaysLater && notifyContests[contestId];
    });
    if (contestsNext7Days.length > 0) {
      contestsNext7Days.forEach(contest => {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: `Upcoming Contest: ${contest.event}`,
          message: `${contest.event} on ${contest.resource} at ${new Date(contest.start).toLocaleString()}`
        });
      });
    }
  });
}

// Notify 1 hour before contest start
async function notifyUpcomingContests() {
  chrome.storage.sync.get(["selectedPlatforms", "notifyContests"], async (res) => {
    const selectedPlatforms = res.selectedPlatforms || [];
    const notifyContests = res.notifyContests || {};
    const contests = await fetchAllContests(selectedPlatforms);
    const now = new Date();
    contests.forEach(contest => {
      const start = new Date(contest.start);
      const diff = (start - now) / (1000 * 60); // minutes
      const contestId = encodeURIComponent(contest.event + contest.start + contest.resource);
      if (diff > 0 && diff <= 60 && notifyContests[contestId]) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: `Contest Starting Soon: ${contest.event}`,
          message: `${contest.event} on ${contest.resource} starts at ${start.toLocaleTimeString()}`
        });
      }
    });
  });
}
