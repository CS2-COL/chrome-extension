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
        .catch(error => {
            error = `HTTP error during /api/users/me: ${error}`;
            console.error(error);
            // chrome.tabs.sendMessage(sender.tab.id, {
            //     type: 'PASS_ERROR',
            //     error: error
            // });
        });

        if (!response.ok) {
            console.error(`HTTP error during /api/users/me: ${response.status}`);
            return false;
        }

        const currentUser = await response.json();
        return currentUser;
    } catch (error) {
        error = `HTTP error during /api/users/me: ${error}`
        console.error(error)
        // chrome.tabs.sendMessage(sender.tab.id, {
        //     type: 'PASS_ERROR',
        //     error: error
        // });
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
        .catch(error => {
            error = `HTTP error during /api/import-stats: ${error}`
            console.error(error)
            // chrome.tabs.sendMessage(sender.tab.id, {
            //     type: 'PASS_ERROR',
            //     error: error
            // });
        });

        if (!response.ok) {
            console.error(`HTTP error during /api/import-stats: ${response.status}`);
            return false;
        }

        const importResult = await response.json();
        return importResult;
    } catch (error) {
        error = `Error during sendImportedHistory: ${error}`;
        console.error(error);
        // chrome.tabs.sendMessage(sender.tab.id, {
        //     type: 'PASS_ERROR',
        //     error: error
        // });
        return false;
    }
}
