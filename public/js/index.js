import zoomSdk from '@zoom/appssdk';

(async () => {
    try {
        const configResponse = await zoomSdk.config({
            capabilities: [
                'startRTMS',
                'stopRTMS',
                'getMeetingParticipants',
                'onParticipantChange',
                'getUserContext',
            ],
        });

        console.debug('Zoom JS SDK Configuration', configResponse);

        const { runningContext } = configResponse;
        if (runningContext === 'inMeeting') {
            await zoomSdk.callZoomApi('startRTMS');
        }
    } catch (e) {
        console.error(e);
    }
})();

// --- Toastmasters App Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Round Robin Participants ---
    const participantInput = document.getElementById('participant-name');
    const addParticipantBtn = document.getElementById('add-participant');
    const participantList = document.getElementById('participant-list');

    // Helper to clear and render participant list
    function renderParticipantList(participants) {
        participantList.innerHTML = '';
        participants.forEach((p) => {
            const li = document.createElement('li');
            li.textContent = p.screenName || p;
            participantList.appendChild(li);
        });
    }

    // Show a message if auto-population is unavailable
    function showParticipantInfoMessage(msg) {
        let info = document.getElementById('participant-info-msg');
        if (!info) {
            info = document.createElement('div');
            info.id = 'participant-info-msg';
            info.style.color = '#990000';
            info.style.fontWeight = 'bold';
            info.style.margin = '8px 0';
            participantList.parentElement.insertBefore(info, participantList);
        }
        info.textContent = msg;
    }

    // --- Automatic participant list from Zoom ---
    async function tryPopulateParticipantsFromZoom() {
        if (!window.zoomSdk) {
            console.debug('zoomSdk not available');
            showParticipantInfoMessage(
                'Zoom SDK not available. Run inside Zoom.'
            );
            return;
        }
        try {
            const userCtx = await zoomSdk.getUserContext();
            console.debug('Zoom user context:', userCtx);
            if (userCtx.role === 'host' || userCtx.role === 'coHost') {
                const resp = await zoomSdk.getMeetingParticipants();
                console.debug('Zoom meeting participants:', resp);
                if (Array.isArray(resp)) {
                    renderParticipantList(resp);
                } else if (resp && Array.isArray(resp.participants)) {
                    renderParticipantList(resp.participants);
                }
                // Listen for changes
                zoomSdk.onParticipantChange(async () => {
                    const update = await zoomSdk.getMeetingParticipants();
                    console.debug('Zoom participant change event:', update);
                    if (Array.isArray(update)) {
                        renderParticipantList(update);
                    } else if (update && Array.isArray(update.participants)) {
                        renderParticipantList(update.participants);
                    }
                });
                showParticipantInfoMessage(
                    'Participant list auto-populated from Zoom.'
                );
            } else {
                showParticipantInfoMessage(
                    'Only the host or co-host can auto-populate the participant list.'
                );
            }
        } catch (e) {
            console.error('Error getting Zoom participants:', e);
            showParticipantInfoMessage(
                'Could not auto-populate participants. Are you the host/co-host and running inside Zoom?'
            );
        }
    }
    tryPopulateParticipantsFromZoom();

    addParticipantBtn?.addEventListener('click', () => {
        const name = participantInput.value.trim();
        if (name) {
            const li = document.createElement('li');
            li.textContent = name;
            participantList.appendChild(li);
            participantInput.value = '';
        }
    });
    participantInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addParticipantBtn.click();
    });

    // --- Timer Utility ---
    function createTimer(displayElem, timerElem, marks) {
        let interval = null;
        let startTime = null;
        let elapsed = 0;

        function format(ms) {
            const totalSec = Math.floor(ms / 1000);
            const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const sec = String(totalSec % 60).padStart(2, '0');
            return `${min}:${sec}`;
        }

        function setColor(ms) {
            timerElem.classList.remove('yellow', 'green', 'red');
            if (marks.red && ms >= marks.red) timerElem.classList.add('red');
            else if (marks.green && ms >= marks.green)
                timerElem.classList.add('green');
            else if (marks.yellow && ms >= marks.yellow)
                timerElem.classList.add('yellow');
        }

        function start() {
            if (interval) return;
            startTime = Date.now() - elapsed;
            interval = setInterval(() => {
                elapsed = Date.now() - startTime;
                displayElem.textContent = format(elapsed);
                setColor(elapsed);
            }, 200);
        }
        function stop() {
            clearInterval(interval);
            interval = null;
        }
        function reset() {
            stop();
            elapsed = 0;
            displayElem.textContent = '00:00';
            timerElem.classList.remove('yellow', 'green', 'red');
        }
        return { start, stop, reset };
    }

    // --- Prepared Speech Timer ---
    const psTimerDisplay = document.getElementById('ps-timer-display');
    const psTimerElem = document.getElementById('ps-timer');
    const psStartBtn = document.getElementById('ps-start');
    const psStopBtn = document.getElementById('ps-stop');
    // If timer div doesn't have id, fallback to parent
    const psTimerDiv = psTimerElem || psTimerDisplay.parentElement;
    const psTimer = createTimer(psTimerDisplay, psTimerDiv, {
        yellow: 4 * 60 * 1000,
        green: 5 * 60 * 1000,
        red: 6 * 60 * 1000,
    });
    psStartBtn?.addEventListener('click', () => psTimer.start());
    psStopBtn?.addEventListener('click', () => psTimer.stop());
    // Double click stop to reset
    psStopBtn?.addEventListener('dblclick', () => psTimer.reset());

    // --- Table Topics Timer ---
    const ttTimerDisplay = document.getElementById('tt-timer-display');
    const ttTimerElem = document.getElementById('tt-timer');
    const ttStartBtn = document.getElementById('tt-start');
    const ttStopBtn = document.getElementById('tt-stop');
    const ttTimerDiv = ttTimerElem || ttTimerDisplay.parentElement;
    const ttTimer = createTimer(ttTimerDisplay, ttTimerDiv, {
        yellow: 1 * 60 * 1000,
        green: 90 * 1000,
        red: 105 * 1000,
    });
    ttStartBtn?.addEventListener('click', () => ttTimer.start());
    ttStopBtn?.addEventListener('click', () => ttTimer.stop());
    ttStopBtn?.addEventListener('dblclick', () => ttTimer.reset());

    // --- Table Topics Management ---
    const topicInput = document.getElementById('new-topic');
    const addTopicBtn = document.getElementById('add-topic');
    const topicList = document.getElementById('topic-list');
    const pickTopicBtn = document.getElementById('pick-topic');
    const revealedTopic = document.getElementById('revealed-topic');
    let topics = [];

    addTopicBtn?.addEventListener('click', () => {
        const topic = topicInput.value.trim();
        if (topic) {
            topics.push(topic);
            const li = document.createElement('li');
            li.textContent = `${topics.length}`;
            li.title = 'Click to reveal';
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                revealedTopic.textContent = topic;
            });
            topicList.appendChild(li);
            topicInput.value = '';
        }
    });
    topicInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTopicBtn.click();
    });
    pickTopicBtn?.addEventListener('click', () => {
        if (topics.length === 0) return;
        const idx = Math.floor(Math.random() * topics.length);
        revealedTopic.textContent = topics[idx];
    });
});
