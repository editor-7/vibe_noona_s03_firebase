import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  push,
  update,
  remove,
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const TODOS_PATH = 'todos';

(function () {
  'use strict';

  const todoInput = document.getElementById('todoInput');
  const addBtn = document.getElementById('addBtn');
  const todoList = document.getElementById('todoList');
  const archiveList = document.getElementById('archiveList');
  const countText = document.getElementById('countText');
  const editSection = document.getElementById('editSection');
  const editInput = document.getElementById('editInput');
  const saveEditBtn = document.getElementById('saveEditBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const errorBox = document.getElementById('errorBox');
  const connectionStatus = document.getElementById('connectionStatus');

  let todos = [];
  let editingId = null;

  function setConnectionStatus(text, state) {
    if (!connectionStatus) return;
    connectionStatus.textContent = text;
    connectionStatus.className = 'connection-status' + (state ? ' ' + state : '');
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function todosFromData(data) {
    const list = [];
    if (!data || typeof data !== 'object') return list;
    Object.keys(data).forEach(function (id) {
      const item = data[id];
      if (item && typeof item === 'object') {
        list.push({
          id: id,
          text: item.content || '',
          done: item.completed === true,
          createdAt: item.createdAt || 0,
        });
      }
    });
    list.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }

  function startListening() {
    const todosRef = ref(db, TODOS_PATH);
    onValue(
      todosRef,
      function (snapshot) {
        const data = snapshot.val();
        todos = todosFromData(data);
        clearError();
        setConnectionStatus('Realtime Database 연결됨', 'connected');
        render();
      },
      function (err) {
        console.error(err);
        setConnectionStatus('연결 실패', 'failed');
        if (err.code === 'PERMISSION_DENIED' || (err.message && err.message.includes('permission'))) {
          showError('Realtime Database 규칙 때문에 접근이 막혔어요. Firebase 콘솔 → Realtime Database → 규칙 탭에서 읽기/쓰기 true 로 설정 후 게시하세요.');
        } else {
          showError('할일 목록 불러오기 실패: ' + (err.message || err.code));
        }
      }
    );
  }

  function runApp() {
    if (window.location.protocol === 'file:') {
      setConnectionStatus('연동 안 됨: 파일로 열면 Firebase가 동작하지 않아요.', 'failed');
      showError('이 페이지를 "파일 열기"로 실행하면 연동이 안 됩니다. 반드시 로컬 서버로 실행하세요. → 터미널에서 "npx serve ." 실행 후 나온 주소로 접속하세요.');
      return;
    }
    if (!firebaseConfig.databaseURL) {
      showError('firebaseConfig.js에 databaseURL이 없어요. Realtime Database URL을 넣어주세요.');
      return;
    }
    startListening();
  }

  function getActiveTodos() {
    return todos.filter(function (t) {
      return !t.done;
    });
  }

  function getArchiveTodos() {
    return todos.filter(function (t) {
      return t.done;
    });
  }

  function updateCount() {
    const active = getActiveTodos();
    countText.textContent = active.length === 0 ? '0개의 할일' : active.length + '개의 할일';
  }

  function renderEmptyMessage() {
    const active = getActiveTodos();
    let empty = document.querySelector('.empty-message');
    if (active.length === 0) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'empty-message';
        empty.textContent = '할일이 없습니다. 위에서 새로 추가해 보세요.';
        todoList.appendChild(empty);
      }
      empty.classList.remove('hidden');
    } else if (empty) {
      empty.classList.add('hidden');
    }
  }

  async function toggleDone(id) {
    const item = todos.find(function (t) {
      return t.id === id;
    });
    if (!item) return;
    try {
      const todoRef = ref(db, TODOS_PATH + '/' + id);
      await update(todoRef, { completed: !item.done });
      clearError();
    } catch (err) {
      console.error(err);
      showError(err.message || '완료 상태 변경에 실패했습니다.');
    }
  }

  function createTodoElement(item) {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.id = item.id;
    if (item.done) li.classList.add('done');

    const label = document.createElement('label');
    label.className = 'todo-check-wrap';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-check';
    checkbox.checked = item.done;
    checkbox.addEventListener('change', function () {
      toggleDone(item.id);
    });

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = item.text;

    label.appendChild(checkbox);
    label.appendChild(span);

    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', function () {
      startEdit(item.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', function () {
      removeTodo(item.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(label);
    li.appendChild(actions);
    return li;
  }

  function render() {
    const active = getActiveTodos();
    const archived = getArchiveTodos();

    todoList.innerHTML = '';
    active.forEach(function (item) {
      todoList.appendChild(createTodoElement(item));
    });

    archiveList.innerHTML = '';
    archived.forEach(function (item) {
      archiveList.appendChild(createTodoElement(item));
    });

    updateCount();
    renderEmptyMessage();
  }

  async function addTodo() {
    const text = todoInput.value.trim();
    if (!text) return;
    todoInput.value = '';
    todoInput.focus();
    try {
      const todosRef = ref(db, TODOS_PATH);
      await push(todosRef, {
        content: text,
        completed: false,
        createdAt: Date.now(),
      });
      clearError();
      setConnectionStatus('저장됨!', 'connected');
      setTimeout(function () {
        setConnectionStatus('Realtime Database 연결됨', 'connected');
      }, 1500);
    } catch (err) {
      console.error(err);
      if (err.code === 'PERMISSION_DENIED' || (err.message && err.message.includes('permission'))) {
        showError('Realtime Database 규칙 때문에 저장이 안 돼요. 콘솔 → Realtime Database → 규칙 → 읽기/쓰기 true 후 게시하세요.');
      } else {
        showError('저장 실패: ' + (err.message || err.code));
      }
      todoInput.value = text;
    }
  }

  function startEdit(id) {
    const item = todos.find(function (t) {
      return t.id === id;
    });
    if (!item) return;
    editingId = id;
    editInput.value = item.text;
    editSection.classList.remove('hidden');
    editInput.focus();
    document.querySelectorAll('.todo-item').forEach(function (el) {
      el.classList.toggle('editing', el.dataset.id === id);
    });
  }

  async function saveEdit() {
    if (editingId == null) return;
    const text = editInput.value.trim();
    if (!text) return;
    try {
      const todoRef = ref(db, TODOS_PATH + '/' + editingId);
      await update(todoRef, { content: text });
      clearError();
      cancelEdit();
    } catch (err) {
      console.error(err);
      showError(err.message || '수정에 실패했습니다.');
    }
  }

  function cancelEdit() {
    editingId = null;
    editInput.value = '';
    editSection.classList.add('hidden');
    document.querySelectorAll('.todo-item').forEach(function (el) {
      el.classList.remove('editing');
    });
  }

  async function removeTodo(id) {
    if (editingId === id) cancelEdit();
    try {
      const todoRef = ref(db, TODOS_PATH + '/' + id);
      await remove(todoRef);
      clearError();
    } catch (err) {
      console.error(err);
      showError(err.message || '삭제에 실패했습니다.');
    }
  }

  addBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  });

  saveEditBtn.addEventListener('click', saveEdit);
  cancelEditBtn.addEventListener('click', cancelEdit);
  editInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  });

  runApp();
})();
