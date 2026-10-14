const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "studyflow_tasks_v1";
const THEME_KEY = "studyflow_theme_v1";

let tasks = [];
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  tasks = Array.isArray(saved) ? saved : [];
} catch {
  tasks = [];
}

let currentFilter = "all";
let currentPage = "dashboard";
let secondsLeft = 25 * 60;
let timerRunning = false;
let timerInterval = null;
let isBreak = false;
let toastTimeout;

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast("Unable to save tasks in this browser.");
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function updateDate() {
  const now = new Date();
  const hour = now.getHours();

  $("greeting").innerHTML =
    `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}! <span>✦</span>`;

  $("todayDate").textContent = now.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).toUpperCase();

  $("taskDate").textContent = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function updateStats() {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const pending = total - completed;
  const percentage = total ? Math.round(completed / total * 100) : 0;

  $("totalTasks").textContent = total;
  $("completedTasks").textContent = completed;
  $("pendingTasks").textContent = pending;
  $("progressPercent").textContent = percentage + "%";
  $("progressBar").style.width = percentage + "%";
  $("progressBar").setAttribute("aria-valuenow", percentage);
}

function renderTasks() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = tasks.filter(task => {
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "active" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    return matchesFilter && task.title.toLowerCase().includes(query);
  });

  $("taskList").innerHTML = filtered.map(task => `
    <article class="task-item ${task.completed ? "done" : ""}">
      <input class="task-check" type="checkbox"
        data-action="toggle" data-id="${escapeHTML(task.id)}"
        ${task.completed ? "checked" : ""}
        aria-label="Complete ${escapeHTML(task.title)}">

      <div class="task-details">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          <span class="priority ${escapeHTML(task.priority)}">
            ${escapeHTML(task.priority)} priority
          </span>
          <span class="task-status">
            ${task.completed ? "✓ Completed" : "◷ Pending"}
          </span>
        </div>
      </div>

      <button class="delete-btn" type="button"
        data-action="delete" data-id="${escapeHTML(task.id)}"
        aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">×</button>
    </article>
  `).join("");

  $("emptyState").style.display = filtered.length ? "none" : "block";

  if (!filtered.length && query) {
    $("emptyState").innerHTML =
      "<span>⌕</span><strong>No matching tasks</strong>Try another search.";
  } else if (!filtered.length) {
    $("emptyState").innerHTML =
      "<span>✦</span><strong>Your next achievement starts here</strong>Add a task above to get started.";
  }

  updateStats();
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskInput").value.trim();
  if (!title) {
    showToast("Please enter a task name.");
    return;
  }

  tasks.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    title,
    priority: $("priorityInput").value,
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasks();
  $("taskInput").value = "";
  currentFilter = "all";

  document.querySelectorAll(".filter-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === "all");
  });

  renderTasks();
  showToast("Task added successfully!");
  $("taskInput").focus();
});

$("taskList").addEventListener("change", event => {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;

  const task = tasks.find(item => item.id === checkbox.dataset.id);
  if (!task) return;

  task.completed = checkbox.checked;
  saveTasks();
  renderTasks();
  showToast(task.completed ? "Great work! Task completed." : "Task marked pending.");
});

$("taskList").addEventListener("click", event => {
  const button = event.target.closest('[data-action="delete"]');
  if (!button) return;

  tasks = tasks.filter(task => task.id !== button.dataset.id);
  saveTasks();
  renderTasks();
  showToast("Task deleted.");
});

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();
  });
});

$("searchInput").addEventListener("input", renderTasks);

function setPage(page) {
  currentPage = page;

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const titles = {
    dashboard: "Today's tasks",
    tasks: "My tasks",
    progress: "Your progress",
    focus: "Focus session"
  };

  $("sectionTitle").textContent = titles[page] || "Today's tasks";

  if (page === "tasks") {
    currentFilter = "all";
    document.querySelectorAll(".filter-btn").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === "all");
    });
    renderTasks();
    $("taskPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (page === "progress") {
    showToast(`${$("progressPercent").textContent} complete · ${$("pendingTasks").textContent} tasks pending.`);
    $("taskPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (page === "focus") {
    document.querySelector(".focus-card").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => setPage(button.dataset.page));
});

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("themeBtn").innerHTML = dark
    ? '☀ <span>Light mode</span>'
    : '☾ <span>Dark mode</span>';

  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {}
}

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem(THEME_KEY) || "light";
} catch {}

applyTheme(savedTheme === "dark");

$("themeBtn").addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
});

function renderTimer() {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  $("timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  $("timerLabel").textContent = isBreak ? "BREAK TIME" : "FOCUS TIME";

  const total = isBreak ? 5 * 60 : 25 * 60;
  const progress = (total - secondsLeft) / total;
  const degrees = Math.max(0, Math.min(360, progress * 360));

  document.querySelector(".timer-circle").style.background =
    `conic-gradient(var(--accent) ${degrees}deg, var(--border) ${degrees}deg)`;

  $("timerStart").textContent = timerRunning ? "Ⅱ Pause" : "▶ Start";
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  renderTimer();
}

$("timerStart").addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    return;
  }

  timerRunning = true;
  renderTimer();

  timerInterval = setInterval(() => {
    secondsLeft--;

    if (secondsLeft <= 0) {
      stopTimer();
      isBreak = !isBreak;
      secondsLeft = isBreak ? 5 * 60 : 25 * 60;
      renderTimer();
      showToast(isBreak
        ? "Focus session complete! Take a 5-minute break."
        : "Break finished! Ready for another focus session?");
      return;
    }

    renderTimer();
  }, 1000);
});

$("timerReset").addEventListener("click", () => {
  stopTimer();
  isBreak = false;
  secondsLeft = 25 * 60;
  renderTimer();
  showToast("Timer reset to 25 minutes.");
});

updateDate();
renderTasks();
renderTimer();
