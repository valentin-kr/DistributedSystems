const SESSION_KEY = 'timechat-user';

const state = {
  users: [],
  rooms: [],
  currentUser: null, // { id, username, phoneNumber, token }
  currentRoomId: null,
  currentRoomCreatorId: null,
  intent: null, // 'create' | 'join', set when picking a choice before auth
};

function isCreator() {
  return (
    state.currentUser !== null &&
    state.currentRoomCreatorId !== null &&
    state.currentRoomCreatorId === state.currentUser.id
  );
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch (_) {
      // response wasn't JSON, keep default message
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return null;
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : null;
}

function usernameFor(userId) {
  if (state.currentUser && state.currentUser.id === userId) {
    return state.currentUser.username;
  }
  const user = state.users.find((u) => u.id === userId);
  return user ? user.username : `User ${userId}`;
}

function saveSession() {
  if (state.currentUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.currentUser));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    state.currentUser = JSON.parse(raw);
  } catch (_) {
    state.currentUser = null;
  }
}

function renderHeader() {
  document.getElementById('logged-in-view').hidden = !state.currentUser;
  if (state.currentUser) {
    document.getElementById('logged-in-as').textContent = `Logged in as ${state.currentUser.username}`;
  }
}

// ---- Screen navigation ----

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = true;
  });
  document.getElementById(`screen-${name}`).hidden = false;
}

function goToChoice() {
  state.intent = null;
  showScreen('choice');
}

function goBackFromFlow() {
  if (state.currentUser) {
    showRoomListScreen();
  } else {
    goToChoice();
  }
}

function startCreateFlow() {
  state.intent = 'create';
  if (state.currentUser) {
    showCreateRoomScreen();
  } else {
    showScreen('auth');
  }
}

function startJoinFlow() {
  state.intent = 'join';
  if (state.currentUser) {
    showScreen('join-room');
  } else {
    showScreen('auth');
  }
}

function showCreateRoomScreen() {
  populateDurationSelects();
  updateDurationPreview();
  showScreen('create-room');
}

async function showRoomListScreen() {
  await Promise.all([loadUsers(), loadRoomsList()]);
  showScreen('room-list');
}

async function enterRoom(roomId) {
  state.currentRoomId = roomId;
  document.getElementById('room-info-panel').hidden = true;
  await loadUsers();
  await renderRoomDetail();
  showScreen('room');
}

// ---- Duration picker ----

function populateDurationSelects() {
  const daysSelect = document.getElementById('duration-days');
  const hoursSelect = document.getElementById('duration-hours');

  if (daysSelect.options.length === 0) {
    for (let d = 0; d <= 14; d++) {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = `${d} day${d === 1 ? '' : 's'}`;
      daysSelect.appendChild(opt);
    }
    for (let h = 0; h <= 23; h++) {
      const opt = document.createElement('option');
      opt.value = String(h);
      opt.textContent = `${h} hour${h === 1 ? '' : 's'}`;
      hoursSelect.appendChild(opt);
    }
    daysSelect.value = '1';
    hoursSelect.value = '0';
  }
}

function updateDurationPreview() {
  const days = Number(document.getElementById('duration-days').value);
  const hours = Number(document.getElementById('duration-hours').value);
  const totalHours = days * 24 + hours;
  const preview = document.getElementById('duration-preview');

  if (totalHours <= 0) {
    preview.textContent = 'Pick a duration of at least 1 hour';
    return;
  }
  const finishAt = new Date(Date.now() + totalHours * 3600 * 1000);
  preview.textContent =
    `Chat will end on ${finishAt.toLocaleDateString()} at ` +
    finishAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---- Data loading / rendering ----

async function loadUsers() {
  state.users = await api('/users');
  renderAddMemberOptions();
}

function renderAddMemberOptions() {
  const select = document.getElementById('add-member-select');
  select.innerHTML = '';
  for (const user of state.users) {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.username;
    select.appendChild(option);
  }
}

async function loadRoomsList() {
  state.rooms = await api('/chatrooms');

  const list = document.getElementById('room-list');
  const noRoomsText = document.getElementById('no-rooms-text');
  list.innerHTML = '';

  const myRooms = state.rooms.filter((room) => room.memberIds.includes(state.currentUser.id));
  noRoomsText.hidden = myRooms.length > 0;

  for (const room of myRooms) {
    const li = document.createElement('li');
    li.textContent = room.active ? room.name : `${room.name} (expired)`;
    li.addEventListener('click', () => enterRoom(room.id));
    list.appendChild(li);
  }
}

async function renderRoomDetail() {
  const room = await api(`/chatrooms/${state.currentRoomId}`);

  document.getElementById('room-title').textContent = room.name;
  document.getElementById('room-description-text').textContent = room.description || '';
  state.currentRoomCreatorId = room.creatorId;

  const status = document.getElementById('room-status');
  if (room.active) {
    status.textContent = 'Active';
    status.className = 'active';
  } else {
    status.textContent = 'Expired — read only';
    status.className = 'expired';
  }

  document.getElementById('room-join-code').textContent = room.active
    ? `Join code: ${room.joinCode} — share this so others can join`
    : `Join code: ${room.joinCode} (chat expired, no longer joinable)`;

  const memberList = document.getElementById('member-list');
  memberList.innerHTML = '';
  for (const memberId of room.memberIds) {
    const li = document.createElement('li');
    li.append(usernameFor(memberId) + (memberId === room.creatorId ? ' (creator)' : ''));

    if (isCreator() && memberId !== room.creatorId) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'inline-action';
      removeBtn.addEventListener('click', () => removeMember(memberId));
      li.appendChild(removeBtn);
    }
    memberList.appendChild(li);
  }

  document.getElementById('send-message-form').hidden = !room.active;
  document.getElementById('message-error').textContent = '';

  await renderChatThread();
}

async function renderChatThread() {
  const [messages, media] = await Promise.all([
    api(`/chatrooms/${state.currentRoomId}/messages`),
    api(`/chatrooms/${state.currentRoomId}/media`),
  ]);

  const items = [
    ...messages.map((m) => ({
      kind: 'message',
      id: m.id,
      authorId: m.authorID,
      text: m.text,
      timestamp: m.timestamp,
    })),
    ...media.map((m) => ({
      kind: 'media',
      id: m.id,
      authorId: m.uploaderId,
      filename: m.filename,
      contentType: m.contentType,
      timestamp: m.uploadedAt,
    })),
  ];
  items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const thread = document.getElementById('chat-thread');
  thread.innerHTML = '';

  for (const item of items) {
    const own = item.authorId === state.currentUser.id;
    const bubble = document.createElement('div');
    bubble.className = `bubble ${own ? 'own' : 'other'}`;

    if (!own) {
      const sender = document.createElement('div');
      sender.className = 'bubble-sender';
      sender.textContent = usernameFor(item.authorId);
      bubble.appendChild(sender);
    }

    if (item.kind === 'message') {
      const textEl = document.createElement('div');
      textEl.className = 'bubble-text';
      textEl.textContent = item.text;
      bubble.appendChild(textEl);
    } else {
      const url = `/chatrooms/${state.currentRoomId}/media/${item.id}`;
      if (item.contentType && item.contentType.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        bubble.appendChild(audio);
      } else if (item.contentType && item.contentType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'bubble-image';
        bubble.appendChild(img);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = item.filename;
        bubble.appendChild(link);
      }
    }

    const footer = document.createElement('div');
    footer.className = 'bubble-footer';

    const time = document.createElement('span');
    time.className = 'bubble-time';
    time.textContent = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    footer.appendChild(time);

    bubble.appendChild(footer);

    if (item.kind === 'message') {
      attachLongPress(bubble, (event) => {
        showContextMenu(event.clientX, event.clientY, item.id, item.text);
      });
    }

    thread.appendChild(bubble);
  }

  thread.scrollTop = thread.scrollHeight;
}

// ---- Long-press context menu (copy / delete) ----

const LONG_PRESS_MS = 500;

function attachLongPress(el, onLongPress) {
  let timer = null;
  let firedLongPress = false;

  el.addEventListener('pointerdown', (event) => {
    firedLongPress = false;
    timer = setTimeout(() => {
      firedLongPress = true;
      onLongPress(event);
    }, LONG_PRESS_MS);
  });

  const cancel = () => {
    if (timer) clearTimeout(timer);
  };
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);

  el.addEventListener(
    'click',
    (event) => {
      if (firedLongPress) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

let contextMenuMessageId = null;
let contextMenuMessageText = null;

function showContextMenu(x, y, messageId, text) {
  contextMenuMessageId = messageId;
  contextMenuMessageText = text;

  const menu = document.getElementById('context-menu');
  document.getElementById('context-delete-btn').hidden = !isCreator();
  menu.hidden = false;

  const menuWidth = menu.offsetWidth || 130;
  const menuHeight = menu.offsetHeight || 88;
  menu.style.left = `${Math.min(x, window.innerWidth - menuWidth - 8)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - menuHeight - 8)}px`;
}

function hideContextMenu() {
  document.getElementById('context-menu').hidden = true;
  contextMenuMessageId = null;
  contextMenuMessageText = null;
}

document.getElementById('context-copy-btn').addEventListener('click', async () => {
  if (contextMenuMessageText != null) {
    try {
      await navigator.clipboard.writeText(contextMenuMessageText);
    } catch (_) {
      // clipboard API unavailable or denied; nothing more we can do here
    }
  }
  hideContextMenu();
});

document.getElementById('context-delete-btn').addEventListener('click', async () => {
  if (contextMenuMessageId != null) {
    await deleteMessage(contextMenuMessageId);
  }
  hideContextMenu();
});

// Listening on pointerdown (not click) for "tapped outside" detection: a fresh
// pointerdown can only come from a genuinely new interaction, never from the
// same long-press gesture that just opened this menu.
document.addEventListener('pointerdown', (event) => {
  const menu = document.getElementById('context-menu');
  if (!menu.hidden && !menu.contains(event.target)) {
    hideContextMenu();
  }
});

async function removeMember(userId) {
  await api(`/chatrooms/${state.currentRoomId}/members/${userId}?requesterId=${state.currentUser.id}`, {
    method: 'DELETE',
  });
  await renderRoomDetail();
}

async function deleteMessage(messageId) {
  await api(`/chatrooms/${state.currentRoomId}/messages/${messageId}?requesterId=${state.currentUser.id}`, {
    method: 'DELETE',
  });
  await renderChatThread();
}

async function uploadMediaBlob(blob, filename) {
  const errorEl = document.getElementById('media-error');
  errorEl.textContent = '';
  const formData = new FormData();
  formData.append('file', blob, filename);
  const username = encodeURIComponent(usernameFor(state.currentUser.id));

  try {
    await api(
      `/chatrooms/${state.currentRoomId}/media?userId=${state.currentUser.id}&username=${username}`,
      { method: 'POST', body: formData }
    );
    await renderChatThread();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// ---- Voice recording ----

let mediaRecorder = null;
let recordedChunks = [];

document.getElementById('record-btn').addEventListener('click', async () => {
  const btn = document.getElementById('record-btn');
  const statusEl = document.getElementById('record-status');

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      btn.textContent = 'Voice';
      statusEl.textContent = 'Uploading voice message…';
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      await uploadMediaBlob(blob, `voice-${Date.now()}.webm`);
      statusEl.textContent = '';
    };

    mediaRecorder.start();
    btn.textContent = 'Stop';
    statusEl.textContent = 'Recording…';
  } catch (err) {
    statusEl.textContent = `Microphone error: ${err.message}`;
  }
});

// ---- Navigation wiring ----

document.getElementById('choice-create-btn').addEventListener('click', startCreateFlow);
document.getElementById('choice-join-btn').addEventListener('click', startJoinFlow);
document.getElementById('room-list-create-btn').addEventListener('click', startCreateFlow);
document.getElementById('room-list-join-btn').addEventListener('click', startJoinFlow);
document.getElementById('auth-back-btn').addEventListener('click', goBackFromFlow);
document.getElementById('create-room-back-btn').addEventListener('click', goBackFromFlow);
document.getElementById('join-room-back-btn').addEventListener('click', goBackFromFlow);
document.getElementById('room-back-btn').addEventListener('click', showRoomListScreen);
document.getElementById('duration-days').addEventListener('change', updateDurationPreview);
document.getElementById('duration-hours').addEventListener('change', updateDurationPreview);

document.getElementById('room-info-btn').addEventListener('click', () => {
  const panel = document.getElementById('room-info-panel');
  panel.hidden = !panel.hidden;
});

document.getElementById('attach-btn').addEventListener('click', () => {
  document.getElementById('media-file').click();
});

document.getElementById('media-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  await uploadMediaBlob(file, file.name);
  event.target.value = '';
});

// ---- Auth ----

document.getElementById('request-code-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const phoneNumber = document.getElementById('phone-number').value;
  const errorEl = document.getElementById('auth-error');
  const noteEl = document.getElementById('simulated-sms-note');
  errorEl.textContent = '';

  try {
    const result = await api('/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });
    noteEl.textContent =
      `Simulated SMS — your code is ${result.code} ` +
      '(a real deployment would text this to your phone instead)';
    document.getElementById('verify-code').value = result.code;
    document.getElementById('verify-form').hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('verify-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const phoneNumber = document.getElementById('phone-number').value;
  const code = document.getElementById('verify-code').value;
  const username = document.getElementById('signup-username').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';

  try {
    const user = await api('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, code, username: username || undefined }),
    });
    state.currentUser = {
      id: user.id,
      username: user.username,
      phoneNumber: user.phone_number,
      token: user.token,
    };
    saveSession();
    renderHeader();

    if (state.intent === 'create') {
      showCreateRoomScreen();
    } else if (state.intent === 'join') {
      showScreen('join-room');
    } else {
      await showRoomListScreen();
    }
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state.currentUser = null;
  state.currentRoomId = null;
  state.intent = null;
  saveSession();
  renderHeader();
  goToChoice();
});

// ---- Room actions ----

document.getElementById('new-room-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('room-name').value;
  const description = document.getElementById('room-description').value;
  const days = Number(document.getElementById('duration-days').value);
  const hours = Number(document.getElementById('duration-hours').value);
  const expiryHours = days * 24 + hours;
  const errorEl = document.getElementById('create-room-error');
  errorEl.textContent = '';

  if (expiryHours <= 0) {
    errorEl.textContent = 'Pick a duration of at least 1 hour';
    return;
  }

  try {
    const room = await api('/chatrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, expiryHours, userId: state.currentUser.id }),
    });
    document.getElementById('room-name').value = '';
    document.getElementById('room-description').value = '';
    await enterRoom(room.id);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('join-room-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const codeInput = document.getElementById('join-code');
  const errorEl = document.getElementById('join-error');
  errorEl.textContent = '';

  try {
    const room = await api('/chatrooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput.value, userId: state.currentUser.id }),
    });
    codeInput.value = '';
    await enterRoom(room.id);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('add-member-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const userId = Number(document.getElementById('add-member-select').value);
  await api(`/chatrooms/${state.currentRoomId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await renderRoomDetail();
});

document.getElementById('send-message-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('message-text');
  const errorEl = document.getElementById('message-error');
  errorEl.textContent = '';
  if (!input.value.trim()) return;
  try {
    await api(`/chatrooms/${state.currentRoomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.value, userId: state.currentUser.id }),
    });
    input.value = '';
    await renderChatThread();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---- Init ----

(async function init() {
  loadSession();
  renderHeader();
  if (state.currentUser) {
    await showRoomListScreen();
  } else {
    goToChoice();
  }
})();
