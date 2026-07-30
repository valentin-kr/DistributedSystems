const SESSION_KEY = 'timechat-user';

const state = {
  users: [],
  rooms: [],
  currentUser: null, // { id, username, phoneNumber, token }
  currentRoomId: null,
  currentRoomCreatorId: null,
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

function renderAuthState() {
  document.getElementById('logged-out-view').hidden = !!state.currentUser;
  document.getElementById('logged-in-view').hidden = !state.currentUser;
  document.getElementById('app-main').hidden = !state.currentUser;

  if (state.currentUser) {
    document.getElementById('logged-in-as').textContent = `Logged in as ${state.currentUser.username}`;
  }
}

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

async function loadRooms() {
  state.rooms = await api('/chatrooms');

  const list = document.getElementById('room-list');
  list.innerHTML = '';
  for (const room of state.rooms) {
    const li = document.createElement('li');
    li.textContent = room.active ? room.name : `${room.name} (expired)`;
    if (room.id === state.currentRoomId) {
      li.classList.add('selected');
    }
    li.addEventListener('click', () => selectRoom(room.id));
    list.appendChild(li);
  }
}

async function selectRoom(roomId) {
  state.currentRoomId = roomId;
  await Promise.all([loadRooms(), renderRoomDetail()]);
}

async function renderRoomDetail() {
  const [room] = await Promise.all([api(`/chatrooms/${state.currentRoomId}`), loadUsers()]);

  document.getElementById('no-room-selected').hidden = true;
  document.getElementById('room-content').hidden = false;

  document.getElementById('room-title').textContent = room.name;
  document.getElementById('room-description-text').textContent = room.description || '';
  state.currentRoomCreatorId = room.creatorId;

  const status = document.getElementById('room-status');
  if (room.active) {
    status.textContent = `Active — expires ${new Date(room.expiryDate).toLocaleString()}`;
    status.className = 'active';
  } else {
    status.textContent = 'Expired — messaging disabled, media still available';
    status.className = 'expired';
  }

  document.getElementById('room-join-code').textContent = room.active
    ? `Join code: ${room.joinCode} — share this so others can join`
    : '';

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

  await Promise.all([loadMessages(), loadMedia()]);
}

async function loadMessages() {
  const messages = await api(`/chatrooms/${state.currentRoomId}/messages`);
  const list = document.getElementById('message-list');
  list.innerHTML = '';
  for (const message of messages) {
    const li = document.createElement('li');
    li.append(`${usernameFor(message.authorID)}: ${message.text}`);

    if (isCreator()) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'inline-action';
      deleteBtn.addEventListener('click', () => deleteMessage(message.id));
      li.appendChild(deleteBtn);
    }
    list.appendChild(li);
  }
}

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
  await loadMessages();
}

async function loadMedia() {
  const media = await api(`/chatrooms/${state.currentRoomId}/media`);
  const list = document.getElementById('media-list');
  list.innerHTML = '';
  for (const item of media) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/chatrooms/${state.currentRoomId}/media/${item.id}`;
    link.target = '_blank';
    link.textContent = item.filename;
    li.appendChild(link);
    li.append(` — uploaded by ${item.uploaderName}`);
    list.appendChild(li);
  }
}

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
    renderAuthState();
    await loadUsers();
    await loadRooms();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state.currentUser = null;
  state.currentRoomId = null;
  saveSession();
  renderAuthState();
});

document.getElementById('new-room-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('room-name').value;
  const description = document.getElementById('room-description').value;
  const expiryHours = Number(document.getElementById('room-expiry').value);

  const room = await api('/chatrooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, expiryHours, userId: state.currentUser.id }),
  });

  document.getElementById('room-name').value = '';
  document.getElementById('room-description').value = '';

  await selectRoom(room.id);
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
    await selectRoom(room.id);
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
  try {
    await api(`/chatrooms/${state.currentRoomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.value, userId: state.currentUser.id }),
    });
    input.value = '';
    await loadMessages();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('upload-media-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById('media-file');
  const errorEl = document.getElementById('media-error');
  errorEl.textContent = '';
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  const username = encodeURIComponent(usernameFor(state.currentUser.id));

  try {
    await api(
      `/chatrooms/${state.currentRoomId}/media?userId=${state.currentUser.id}&username=${username}`,
      { method: 'POST', body: formData }
    );
    fileInput.value = '';
    await loadMedia();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

(async function init() {
  loadSession();
  renderAuthState();
  if (state.currentUser) {
    await loadUsers();
    await loadRooms();
  }
})();
