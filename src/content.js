let lastImportTime;

let intermediateState;

let g_historyCursor;
let g_rgDescriptions;
let g_steamID;

let retryCount = 0;

let resultItemsArray;

const parser = new DOMParser();

const currentUrl = `https://steamcommunity.com${window.location.pathname}`;
const currentUrlParams = new URLSearchParams(window.location.search);

if (window.location.pathname.includes('/inventoryhistory') && currentUrlParams.get('l') === 'english' && (currentUrlParams.get('app[]') === '730' || currentUrlParams.get('app[0]') === '730')) {
    initialize();
    renderDashboard();
}

// clean up unused key from previous versions
chrome.storage.local.get('lastImportTime', (result) => {
    if (result.lastImportTime !== undefined) {
        chrome.storage.local.remove('lastImportTime');
    }
});

async function getValueFromLocalStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                if (result[key] === undefined) {
                    resolve(0);
                } else {
                    resolve(result[key]);
                }
            }
        });
    });
}

async function initialize() {
    try {
        intermediateState  = (await getValueFromLocalStorage('intermediateState')) || { cursorTime: 0, cursorS: '', items: [] };
        resultItemsArray = intermediateState.items || [];
        console.log('intermediateState: ', intermediateState);
    } catch (error) {
        console.error(`Error retrieving value from local storage: ${error}`);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PASS_CURRENT_CS2COL_USER') {
        if (!message.currentUser) {
            updateStatusBarContent('You are not logged in. Please <a href="https://caseopening.live" class="cs2col-link">log in to caseopening.live</a> and refresh this page to continue.');
            return;
        }

        updateElementContent('cs2col-steam-name', message.currentUser.data.steam_name);
        updateElementContent('cs2col-steam-id', `(${message.currentUser.data.steam_id})`);

        if (message.currentUser.data.last_import_time === null) {
            lastImportTime = new Date('1970-01-01T00:00:00Z');
        } else {
            lastImportTime = new Date(message.currentUser.data.last_import_time+'Z').getTime(); // Add 'Z' to force UTC interpretation
        }

        console.log(`Last import time: ${generateShortDateTime(lastImportTime)}`);
        updateLastImportDatetime(lastImportTime);

        chrome.storage.local.remove('lastImportTime');

        if (g_steamID != message.currentUser.data.steam_id) {
            updateElementContent('cs2col-steam-name', message.currentUser.data.steam_name);
            updateElementContent('cs2col-steam-id', `(${message.currentUser.data.steam_id})`);
            updateStatusBarContent(`Your Steam account does not match the CS2COL user currently logged in. Please <a href="https://caseopening.live" class="cs2col-link">log in again</a> with the correct account and refresh this page.`);
            return;
        }

        if ((new Date().getTime() - lastImportTime) < 12 * 60 * 60 * 1000) {
            updateStatusBarContent('You can only import stats once every 12 hours. Please try again later. If you continue to experience issues, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.');
            return;
        }

        if (intermediateState.cursorTime === 0 || intermediateState.cursorS === '') {
            if (g_rgDescriptions) {
                document.getElementById('initParsingButton').addEventListener('click', () => {
                    parseCurrentPage();
                });
            }
        } else {
            document.getElementById('initParsingButton').addEventListener('click', () => {
                fetchNextPage(intermediateState.cursorTime, intermediateState.cursorS, retryCount);
            });
            updateStatusBarContent(`Your last history collection attempt failed, but your progress was saved locally. Click "Collect History Stats" to resume from where you left off.`);
        }

        showElementById('initParsingButton');
        document.getElementById('agreementSpan').style.display = 'block';
        
    } else if (message.type === 'PASS_ERROR') {
        console.error(message.error);
        updateStatusBarContent(`An unexpected background error occurred. Please try again later. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
    } else if (message.type === 'IMPORT_RESULT') {
        if (message.importResult) {
            intermediateState = {
                cursorTime: 0,
                cursorS: '',
                items: []
            }
            chrome.storage.local.set({ 
                intermediateState: intermediateState
            }, function() {
                console.log('intermediateState saved.');
            });
            if (resultItemsArray.length > 0) {
                updateStatusBarContent(`History stats (${resultItemsArray.length} items) were collected and uploaded. Check it out at <a href="https://caseopening.live/profiles/${g_steamID}" class="cs2col-link">https://caseopening.live/profile/${g_steamID}</a>`);
                hideElementById('saveFileSpan');
            } else {
                updateStatusBarContent(`No new history stats were found since your last import. Try opening more cases! If you believe this is an error, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
            }
        } else {
            updateStatusBarContent(`An error occurred while importing your stats. Please try again later. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
        }
    }
});

document.addEventListener('LOAD_LOCAL_VARIABLES', function(e) {
    g_historyCursor = e.detail.g_historyCursor;
    g_rgDescriptions = e.detail.g_rgDescriptions;
    g_steamID = e.detail.g_steamID;
    if (!g_rgDescriptions) {
        updateStatusBarContent(`No item descriptions were detected on this page. Please refresh and try again. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
    }
});

function renderDashboard() {
    // Fetch the HTML for the injected button and container from `dashboard.html`
    fetch(chrome.runtime.getURL('dashboard.html'))
    .then(response => response.text())
    .then(html => {
        // Locate the element after which the button div should be inserted
        const anchorDiv = document.querySelector('.inventory_history_pagingrow');
        if (anchorDiv) {
            // Create a temporary div to hold the injected HTML content
            const dashboardWrapper = document.createElement('div');
            dashboardWrapper.innerHTML = html;

            // Insert the container after the `inventory_history_pagingrow` div
            anchorDiv.insertAdjacentElement('beforebegin', dashboardWrapper);

            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('injectedScript.js');
            (document.head || document.documentElement).appendChild(script);
            script.onload = () => {
                script.remove();
            };

            // Add an event listener to the button in the injected HTML
            const button = dashboardWrapper.querySelector('#initDashboardButton');
            button.addEventListener('click', () => {
                hideElementById('initDashboardButton');
                showElementById('cs2colDashboardInfo');
                chrome.runtime.sendMessage({ type: 'GET_CURRENT_CS2COL_USER' });
            });
        }
    })
    .catch(error => console.error(`Failed to load dashboard.html: ${error}`));
}

async function parseCurrentPage() {
    if (g_rgDescriptions) {
        const firstPageHistoryRowsHTML = document.getElementById('inventory_history_table').innerHTML;
        parseHTML(firstPageHistoryRowsHTML, g_rgDescriptions);
        if (g_historyCursor) {
            hideElementById('initParsingButton');
            hideElementById('agreementSpan');
            updateCurrentHistoryDatetime(g_historyCursor.time);
            await fetchNextPage(g_historyCursor.time, g_historyCursor.s, retryCount);
        }
        hideElementById('initDashboardButton');
    } else {
        updateStatusBarContent(`An error occurred while analyzing this page. Please refresh and try again. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
    }
}

function hideElementById(id) {
    document.getElementById(id).style.display = 'none';
}

function showElementById(id) {
    document.getElementById(id).style.display = 'flex';
    document.getElementById(id).style.justifyContent = 'center';
}

function updateElementContent(id, content) {
    document.getElementById(id).textContent = content;
}

function updateStatusBarContent(content) {
    document.getElementById('status-bar-span').innerHTML = content;
}

function updateCurrentHistoryDatetime(epochTimestamp) {
    updateStatusBarContent(`Fetching history data from around ${generateShortDateTime(epochTimestamp * 1000)}. Please wait...`);
}

function updateLastImportDatetime(epochTimestamp) {
    if (epochTimestamp > 0) {
        document.getElementById('last-import-datetime-span').textContent = generateShortDateTime(epochTimestamp);
    } else {
        document.getElementById('last-import-datetime-span').textContent = '-';
    }
}

function parseHTML(rawHTML, jsonDescription) {
    // Parsing HTML string to a DOM object for easier querying
    const htmlDoc = parser.parseFromString(rawHTML, 'text/html');

    // Select all trade history rows
    const historyRows = htmlDoc.querySelectorAll('.tradehistoryrow');

    // Iterate over each row to build keys and retrieve item details
    historyRows.forEach(row => {
        // Get the event description
        const eventDescription = row.querySelector('.tradehistory_event_description')?.textContent.trim();

        // Skip if the event description is not 'Unlocked a container'
        if (eventDescription !== 'Unlocked a container')
            return;

        // Extract date and time
        let datetime = row.querySelector('.tradehistory_date')?.textContent.replace(/\t+/g, ' ').trim();
        datetime = datetime.replace(/(\d)([ap]m)/i, '$1 $2').toUpperCase();
        // Convert date and time (local) to a timestamp (UTC)
        const unlockedAtTimestamp = new Date(datetime).getTime();
        if (lastImportTime < unlockedAtTimestamp) {
            // Find all tradehistory_items_withimages divs within tradehistory_content
            const itemGroups = row.querySelectorAll('.tradehistory_content .tradehistory_items.tradehistory_items_withimages');

            let item = null;

            // Iterate over the item groups to find the one with "+"
            for (const itemGroup of itemGroups) {
                const plusMinus = itemGroup.querySelector('.tradehistory_items_plusminus');
                if (plusMinus && plusMinus.textContent.trim() === '+') {
                    // Get the item element (either <a> or <span>)
                    item = itemGroup.querySelector('.tradehistory_items_group a, .tradehistory_items_group span');
                    break;
                }
            }

            if (item) {
                const classId = item.getAttribute('data-classid');
                const instanceId = item.getAttribute('data-instanceid');

                if (classId && instanceId) {
                    const key = `${classId}_${instanceId}`;
                    console.log(`Found new item: ${key}`);
                    const itemDetails = jsonDescription['730'][key];
                    if (itemDetails) {
                        const newItem = {
                            name: itemDetails.name,
                            // name: itemDetails.market_hash_name,
                            exterior: null,
                            unlocked_at: unlockedAtTimestamp/1000
                        };
                        itemDetails.tags.forEach(tag => {
                            switch (tag.category) {
                            case 'Exterior':
                                newItem.exterior = tag.name;
                                break;
                            }
                        });
                        resultItemsArray.push(newItem);
                    }
                }
            }
        }   
    });
}

async function fetchNextPage(time, cursor, retryCount) {
    try {
        const response = await fetch(`${currentUrl}?ajax=1&cursor%5Btime%5D=${time}&cursor%5Btime_frac%5D=0&cursor%5Bs%5D=${cursor}&app%5B%5D=730&l=english`, {
            headers: {
                'x-requested-with': 'XMLHttpRequest'
            },
        });

        if (retryCount > 0 && response.status === 200) {
            retryCount = 0;
        }

        if (response.status === 429) {
            retryCount++;
            console.warn(`Rate limit hit. Retrying in 20 seconds... (Attempt ${retryCount}/10)`);
            updateStatusBarContent(`Steam has temporarily blocked further requests due to high traffic. Retrying in 20 seconds... (Attempt ${retryCount}/10)`);
            if (retryCount < 10) {
                setTimeout(() => fetchNextPage(time, cursor, retryCount), 20000);
                return;
            }
            intermediateState = {
                cursorTime: time,
                cursorS: cursor,
                items: resultItemsArray
            }
            chrome.storage.local.set({ intermediateState: intermediateState }, function() {
                console.log('intermediateState saved.');
            });
            updateStatusBarContent(`Steam has blocked further requests due to API rate limits. Your history stats have been saved locally. Please try again in a few hours. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
            return;
        } else if (response.status != 200) {
            retryCount++;
            console.warn(`Steam returned an error (Code: ${response.status}). Retrying in 20 seconds... (Attempt ${retryCount}/10)`);
            updateStatusBarContent(`Steam returned an error (Code: ${response.status}). Retrying in 20 seconds... (Attempt ${retryCount}/10)`);
            if (retryCount < 10) {
                setTimeout(() => fetchNextPage(time, cursor, retryCount), 20000);
                return;
            }
            intermediateState = {
                cursorTime: time,
                cursorS: cursor,
                items: resultItemsArray
            }
            chrome.storage.local.set({ intermediateState: intermediateState }, function() {
                console.log('intermediateState saved.');
            });
            updateStatusBarContent(`Steam's API is currently unavailable. Your history stats have been saved locally. Please try again in a few hours. If the issue persists, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
            return; 
        }

        const data = await response.json();

        if (data.cursor) {
            const newTime = data.cursor.time;
            const newCursor = data.cursor.s;

            if (newTime > lastImportTime) {
                updateCurrentHistoryDatetime(newTime);
                parseHTML(data.html, data.descriptions);

                setTimeout(() => fetchNextPage(newTime, newCursor, retryCount), 2100);
                return;
            }
        } else {
            parseHTML(data.html, data.descriptions);
        }

        // If there are no more items to fetch
        console.log('No new items.');
        updateStatusBarContent('Success! All available history stats have been collected.');
        
        var payload = {
            'sId': g_steamID,
            'items': resultItemsArray
        };
    
        if (resultItemsArray.length > 0) {
            // Show save button and attach the click event listener
            const saveFileButton = document.getElementById('saveFileButton');
            saveFileButton.addEventListener('click', () => {
                saveFile(JSON.stringify(payload), generateFileName());
            });
            document.getElementById('saveFileSpan').style.display = 'block';
            const encryptedData = encrypt(JSON.stringify(payload), g_steamID);

            // Send the collected data to the background script
            chrome.runtime.sendMessage({ type: 'SEND_IMPORTED_HISTORY', data: encryptedData });
        } else {
            updateStatusBarContent(`No new history stats were found since your last import. Try opening more cases! If you believe this is an error, <a href="https://caseopening.live/support" class="cs2col-link">contact support</a>.`);
        }
    } catch (error) {
        console.error(`Error fetching data: ${error}`);
    }
}

function encrypt(data, key) {
    const dataBytes = new TextEncoder().encode(data);
    const keyBytes = new TextEncoder().encode(key);
    const encryptedBytes = dataBytes.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);

    // Use a loop to convert encryptedBytes to a string instead of using the spread operator
    // Should fix RangeError: Maximum call stack size exceeded
    let encryptedString = '';
    for (let byte of encryptedBytes) {
        encryptedString += String.fromCharCode(byte);
    }

    return btoa(encryptedString);
}

function generateFileName() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `import_${g_steamID}_${day}_${month}_${year}_${hours}_${minutes}.json`;
}

function generateShortDateTime(epochTimestamp) {
    const timestamp = epochTimestamp;
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const shortDate = `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
    return shortDate;
}

function saveFile(content, filename) {
    const rawBlow = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(rawBlow);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}
