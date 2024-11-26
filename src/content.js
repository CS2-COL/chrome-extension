let lastImportTime = 0;

let g_historyCursor;
let g_rgDescriptions;
let g_steamID;

let retryCount = 0;
const resultItemsArray = [];

const currentUrl = `https://steamcommunity.com${window.location.pathname}`;
const currentUrlParams = new URLSearchParams(window.location.search);

if (window.location.pathname.includes('/inventoryhistory') && currentUrlParams.get('l') === 'english' && (currentUrlParams.get('app[]') === '730' || currentUrlParams.get('app[0]') === '730')) {
    initializelastImportTime();
    renderDashboard();
}

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

async function initializelastImportTime() {
    try {
        lastImportTime = await getValueFromLocalStorage('lastImportTime');
        console.log('Last import time:', generateShortDateTime(lastImportTime*1000));
    } catch (error) {
        console.error('Error retrieving value from local storage:', error);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PASS_CURRENT_CS2COL_USER') {
        if (message.currentUser) {
            updateElementContent('cs2col-steam-name', message.currentUser.data.steam_name);
            updateElementContent('cs2col-steam-id', `(${message.currentUser.data.steam_id})`);
            updateLastImportDatetime(lastImportTime*1000);
            if (g_steamID === message.currentUser.data.steam_id) {
                if ((new Date().getTime()/1000 - lastImportTime) > 12 * 60 * 60) {
                        if (g_rgDescriptions) {
                            document.getElementById('initParsingButton').addEventListener('click', () => {
                                parseCurrentPage();
                            });
                            showElementById('initParsingButton');
                            document.getElementById('agreementSpan').style.display = 'block';
                        }
                } else {
                    updateStatusBarContent('Temporarily you can only import stats once in 12 hours. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>');
                }
            } else {
                updateElementContent('cs2col-steam-name', message.currentUser.data.steam_name);
                updateElementContent('cs2col-steam-id', `(${message.currentUser.data.steam_id})`);
                updateStatusBarContent('Please log in again to <a href="https://caseopening.live" class="cs2col-link">https://caseopening.live</a> and refresh this page.');
            }
        } else {
            updateStatusBarContent('Unauthenticated user. Please log in to <a href="https://caseopening.live" class="cs2col-link">https://caseopening.live</a> and refresh this page.');
        }
    } else if (message.type === 'PASS_ERROR') {
        console.error(message.error);
        updateStatusBarContent(`Something went wrong at background. Try again later. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
    } else if (message.type === 'IMPORT_RESULT') {
        if (message.importResult) {
            chrome.storage.local.set({ lastImportTime: new Date().getTime()/1000 }, function() {
                console.log('Last import time saved successfully.');
            });
            if (resultItemsArray.length > 0) {
                updateStatusBarContent(`History stats (${resultItemsArray.length} items) were collected and uploaded. Check it out at <a href="https://caseopening.live/profiles/${g_steamID}" class="cs2col-link">https://caseopening.live/profile/${g_steamID}</a>`);
            } else {
                updateStatusBarContent(`No new items were detected since last import. It's time to open some new cases. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
            }
        } else {
            updateStatusBarContent(`Something went wrong during stats import. Try again later. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
        }
    }
});

document.addEventListener('LOAD_LOCAL_VARIABLES', function(e) {
    g_historyCursor = e.detail.g_historyCursor;
    g_rgDescriptions = e.detail.g_rgDescriptions;
    g_steamID = e.detail.g_steamID;
    if (!g_rgDescriptions) {
        updateStatusBarContent(`No items descriptions were found on the page. Try again later. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
    }
});

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
        updateStatusBarContent(`Something went wrong during current page parsing. Try again later. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
    }
}

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

            // Insert the container after the `profile_small_header_bg` div
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
    .catch(error => console.error('Failed to load dashboard.html:', error));
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
    updateStatusBarContent('Please wait. Collecting items around ' + generateShortDateTime(epochTimestamp*1000)+ ' ...');
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
    const parser = new DOMParser();
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
        const unlockedAtTimestamp = new Date(datetime).getTime() / 1000;
        if (lastImportTime < unlockedAtTimestamp) {
            // Find all tradehistory_items_withimages divs within tradehistory_content
            const itemGroups = row.querySelectorAll('.tradehistory_content .tradehistory_items.tradehistory_items_withimages');

            // If there are multiple tradehistory_items_withimages, get only the last one
            const lastItemGroup = itemGroups[itemGroups.length - 1];

            // Get the item element (either <a> or <span>) from the last item group
            const item = lastItemGroup.querySelector('.tradehistory_items_group a, .tradehistory_items_group span');

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
                            unlocked_at: unlockedAtTimestamp
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
            console.warn('Rate limit hit. Retrying after 20 seconds ...');
            updateStatusBarContent(`Rate limit hit! Retrying after 20 seconds. Attempt ${retryCount}/10.`);
            if (retryCount < 10) {
                setTimeout(() => fetchNextPage(time, cursor, retryCount), 20000);
                return;
            }
            updateStatusBarContent(`Too many requests. Please try again in a couple of hours. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
            return;
        } else if (response.status != 200) {
            retryCount++;
            console.warn(`Steam API error returned ${response.status}. Retrying after 20 seconds ...`);
            updateStatusBarContent(`Steam API error returned ${response.status}. Retrying after 20 seconds. Attempt ${retryCount}/10.`);
            if (retryCount < 10) {
                setTimeout(() => fetchNextPage(time, cursor, retryCount), 20000);
                return;
            }
            updateStatusBarContent(`Steam API is down. Please try again in a couple of hours. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
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
        updateStatusBarContent('All new items collected.');
        
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
            // showElementById('saveFileButton');
            document.getElementById('saveFileSpan').style.display = 'block';
            const encryptedData = encrypt(JSON.stringify(payload), g_steamID);

            // Send the collected data to the background script
            chrome.runtime.sendMessage({ type: 'SEND_IMPORTED_HISTORY', data: encryptedData });
        } else {
            updateStatusBarContent(`No new items were detected since last import. It's time to open some new cases. In case of continuous errors please contact us at <a href="https://caseopening.live/support" class="cs2col-link">https://caseopening.live/support</a>`);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
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
