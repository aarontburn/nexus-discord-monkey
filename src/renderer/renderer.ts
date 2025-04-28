// Sends information to the the process.
const sendToProcess = (eventType: string, ...data: any[]): Promise<void> => {
    return window.ipc.send(window, eventType, data);
}

// Handle events from the process.
const handleEvent = (eventType: string, data: any[]) => {
    switch (eventType) {
        case "path": {
            document.getElementById("path").innerText = data[0];
            break;
        }
        case "missing_dependency": {
            document.getElementById('missing-dependency').style.display = "";
            document.getElementById('content').style.display = 'none';
            break;
        }

        default: {
            console.warn("Uncaught message: " + eventType + " | " + data)
            break;
        }
    }
}

// Attach event handler.
window.ipc.on(window, (eventType: string, data: any[]) => {
    handleEvent(eventType, data);
});


sendToProcess("init");


document.getElementById("reboot-button").addEventListener('click', () => {
    sendToProcess("reboot");
})

