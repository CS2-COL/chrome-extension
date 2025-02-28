chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CURRENT_CS2COL_USER') {
        getCurrentCS2COLUser()
        .then(currentUser => {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'PASS_CURRENT_CS2COL_USER',
                currentUser: currentUser
            });
        })
        .catch(error => {
            error = `Error during getCurrentCS2COLUser: ${error}`;
            console.error(error);
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'PASS_CURRENT_CS2COL_USER',
                currentUser: null 
            });
        });
    } else if (message.type === 'SEND_IMPORTED_HISTORY') {
        sendImportedHistory(message.data)
        .then(importResult => {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'IMPORT_RESULT',
                importResult: importResult
            });
        })
        .catch(error => {
            error = `Error during sendImportedHistory: ${error}`;
            console.error(error);
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'IMPORT_RESULT',
                importResult: importResult
            });
        });
    }
});

async function getCurrentCS2COLUser() {
    try {
        const response = await fetch('https://caseopening.live/api/users/me', {
            method: 'GET',
            credentials: 'include'
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const currentUser = await response.json();
        return currentUser;
    } catch (error) {
        console.error(`Error fetching user data: ${error}`)
        return false;
    }
}

async function sendImportedHistory(encryptedData) {
    console.log('sendImportedHistory ...');
    try {
        const response = await fetch('https://caseopening.live/api/import-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: encryptedData
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const importResult = await response.json();
        return importResult;
    } catch (error) {
        console.error(`Error importing history: ${error}`);
        return false;
    }
}
