// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Load selected platforms and set checkboxes
    chrome.storage.sync.get(["selectedPlatforms"], (res) => {
        const selectedPlatforms = res.selectedPlatforms || [];
        document.querySelectorAll('#options-section input[type="checkbox"]').forEach(cb => {
            cb.checked = selectedPlatforms.includes(cb.value);
        });
    });

    // Save selected platforms when 'Save Platforms' is clicked
    document.getElementById('save-options').addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('#options-section input[type="checkbox"]:checked')).map(cb => cb.value);
        chrome.storage.sync.set({ selectedPlatforms: selected }, () => {
            fetchAndShowContests(); // Refresh contest list based on selection
        });
    });
    const contestSection = document.getElementById('contest-section');
    const contestList = document.getElementById('contest-list');
    const contestLoading = document.getElementById('contest-loading');
    const contestError = document.getElementById('contest-error');
    const contestEmpty = document.getElementById('contest-empty');
    const viewContestsBtn = document.getElementById('view-contests');
    const refreshContestsBtn = document.getElementById('refresh-contests');
    const openToolsBtn = document.getElementById('open-tools');
    const toolsDropdown = document.getElementById('tools-dropdown');

    let lastContests = [];

    function showLoading() {
        contestSection.style.display = 'block';
        contestLoading.style.display = 'block';
        contestError.style.display = 'none';
        contestEmpty.style.display = 'none';
        contestList.innerHTML = '';
    }
    function showError(msg) {
        contestSection.style.display = 'block';
        contestLoading.style.display = 'none';
        contestError.style.display = 'block';
        contestError.textContent = msg;
        contestEmpty.style.display = 'none';
        contestList.innerHTML = '';
    }
    function showEmpty() {
        contestSection.style.display = 'block';
        contestLoading.style.display = 'none';
        contestError.style.display = 'none';
        contestEmpty.style.display = 'block';
        contestList.innerHTML = '';
    }
    function showContests(contests) {
        contestSection.style.display = 'block';
        contestSection.classList.add('fade-in');
        contestLoading.style.display = 'none';
        contestError.style.display = 'none';
        contestEmpty.style.display = contests.length === 0 ? 'block' : 'none';
        contestList.innerHTML = '';
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        contests.filter(contest => {
            const start = new Date(contest.start);
            return start > now && start < sevenDaysLater;
        }).forEach(contest => {
            const li = document.createElement('li');
            li.className = 'contest-item';
            li.innerHTML = `
                <div class="contest-name">${contest.event}</div>
                <div class="contest-time">
                    <strong>Platform:</strong> ${contest.resource}<br>
                    <strong>Start:</strong> ${new Date(contest.start).toLocaleString()}<br>
                    <strong>End:</strong> ${new Date(contest.end).toLocaleString()}<br>
                    <strong>Duration:</strong> ${formatDuration(contest.duration_seconds)}
                </div>
                <div style="margin-top: 8px;">
                    <a href="${contest.href}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 500;">🔗 Go to Contest</a>
                    ${soonBadge(contest.start)}
                </div>
                <div style="margin-top: 8px;">
                    <label><input type="checkbox" class="notify-checkbox" data-contest-id="${encodeURIComponent(contest.event + contest.start + contest.resource)}"> Do you want to get notified?</label>
                </div>
            `;
            contestList.appendChild(li);
        });
        // Load notification preferences
        chrome.storage.sync.get(["notifyContests"], (res) => {
            const notifyContests = res.notifyContests || {};
            document.querySelectorAll('.notify-checkbox').forEach(cb => {
                const contestId = cb.getAttribute('data-contest-id');
                cb.checked = !!notifyContests[contestId];
                cb.addEventListener('change', () => {
                    notifyContests[contestId] = cb.checked;
                    chrome.storage.sync.set({ notifyContests });
                });
            });
        });
    }
    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    }
    function soonBadge(start) {
        const now = new Date();
        const st = new Date(start);
        if ((st - now) < 3 * 60 * 60 * 1000 && (st - now) > 0) {
            return ' <span style="color:#fff;background:linear-gradient(45deg, #e74c3c, #c0392b);padding:4px 8px;border-radius:12px;font-size:0.8em;font-weight:600;box-shadow:0 2px 4px rgba(231,76,60,0.3);">🔥 Starting Soon!</span>';
        }
        return '';
    }
    function sortContests(contests) {
        return contests.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    }

    // Fetch and parse LeetCode contests
    async function fetchLeetCodeContests() {
        try {
            const response = await fetch('https://leetcode.com/contest/');
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

    // Fetch and parse Codeforces contests using their API
    async function fetchCodeforcesContests() {
        try {
            const response = await fetch('https://codeforces.com/api/contest.list?gym=false');
            const data = await response.json();
            if (data.status !== 'OK') return [];
            const now = Date.now() / 1000;
            // Only upcoming contests
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

    // Fetch and parse CodeChef contests by scraping their contest page
    async function fetchCodeChefContests() {
        try {
            const response = await fetch('https://www.codechef.com/contests');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            let contests = [];
            // Find the table for upcoming contests
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

    async function fetchAndShowContests() {
        showLoading();
        chrome.storage.sync.get(["selectedPlatforms"], async (res) => {
            const selectedPlatforms = res.selectedPlatforms || [];
            let contests = [];
            // LeetCode
            if (selectedPlatforms.includes('leetcode.com')) {
                try {
                    const response = await fetch('https://competativeprogramming-contestnotifier.onrender.com/leetcode');
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const contestCards = doc.querySelectorAll('.contest-card');
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
                } catch (e) {
                    showError('Failed to load LeetCode contests from proxy.');
                }
            }
            // CodeChef
            if (selectedPlatforms.includes('codechef.com')) {
                try {
                    const response = await fetch('https://competativeprogramming-contestnotifier.onrender.com/codechef');
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
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
                } catch (e) {
                    showError('Failed to load CodeChef contests from proxy.');
                }
            }
            // Codeforces
            if (selectedPlatforms.includes('codeforces.com')) {
                try {
                    const response = await fetch('https://competativeprogramming-contestnotifier.onrender.com/codeforces');
                    const data = await response.json();
                    if (data.status === 'OK') {
                        const cfContests = data.result.filter(c => c.phase === 'BEFORE').map(c => ({
                            event: c.name,
                            resource: 'codeforces.com',
                            start: new Date(c.startTimeSeconds * 1000).toISOString(),
                            end: new Date((c.startTimeSeconds + c.durationSeconds) * 1000).toISOString(),
                            duration_seconds: c.durationSeconds,
                            href: `https://codeforces.com/contests/${c.id}`
                        }));
                        contests = contests.concat(cfContests);
                    }
                } catch (e) {
                    showError('Failed to load Codeforces contests from proxy.');
                }
            }
            contests = sortContests(contests);
            lastContests = contests;
            if (contests.length === 0) {
                showEmpty();
            } else {
                showContests(contests);
            }
        });
    }

    viewContestsBtn.addEventListener('click', () => {
        fetchAndShowContests();
        refreshContestsBtn.style.display = 'inline-block';
    });
    refreshContestsBtn.addEventListener('click', () => {
        fetchAndShowContests();
    });

    // Coding tools dropdown
    openToolsBtn.addEventListener('click', () => {
        toolsDropdown.style.display = toolsDropdown.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
        if (!openToolsBtn.contains(e.target) && !toolsDropdown.contains(e.target)) {
            toolsDropdown.style.display = 'none';
        }
    });
});
