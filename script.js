/* StudyFlow - JavaScript */

// Load saved tasks and settings
const $ = (selector) => document.querySelector(selector);

let tasks = [];
try {
  tasks = JSON.parse(localStorage.getItem("studyflow.tasks.v1") || "[]");
  if (!Array.isArray(tasks)) tasks = [];
} catch {
  tasks = [];
}

let filter = "all";
let search = "";
let month = new Date();
let selectedDate = dateKey(new Date());
let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerRunning = false;
let focusSessions = Number(localStorage.getItem("studyflow.focusSessions.v1") || 0);

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function safe(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

function saveTasks() {
  localStorage.setItem("studyflow.tasks.v1", JSON.stringify(tasks));
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// Date labels
const today = new Date();
if ($("#topDate")) {
  $("#topDate").textContent = today.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric"
  });
}
if ($("#fullDate")) {
  $("#fullDate").textContent = today.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
}

// Task statistics
function updateStats() {
  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  if ($("#completedStat")) $("#completedStat").textContent = completed;
  if ($("#completionRate")) $("#completionRate").textContent = rate + "%";
  if ($("#completionBar")) $("#completionBar").style.width = rate + "%";
  if ($("#sessionsStat")) $("#sessionsStat").textContent = focusSessions;
  if ($("#streakStat")) $("#streakStat").textContent = completed ? "1" : "0";
  if ($("#completedCaption")) {
    $("#completedCaption").textContent = completed
      ? `${completed} small wins unlocked`
      : "Let's get started";
  }
  if ($("#navTaskCount")) $("#navTaskCount").textContent = pending;
  if ($("#taskHeadingCount")) $("#taskHeadingCount").textContent = tasks.length;
  if ($("#chartCompleted")) $("#chartCompleted").textContent = completed;
  if ($("#chartPending")) $("#chartPending").textContent = pending;
  if ($("#taskFooterText")) {
    $("#taskFooterText").textContent = `${pending} to do · ${completed} completed`;
  }
  renderChart();
}

// Render task list
function renderTasks() {
  const list = $("#taskList");
  if (!list) return;

  const visible = tasks.filter(task => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && !task.completed) ||
      (filter === "completed" && task.completed);

    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      `${task.title} ${task.category} ${task.priority}`
        .toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  }).sort((a, b) =>
    Number(a.completed) - Number(b.completed) ||
    (a.due || "9999").localeCompare(b.due || "9999")
  );

  list.innerHTML = visible.map(task => `
    <div class="task-item ${task.completed ? "completed" : ""}"
         data-id="${safe(task.id)}">
      <input class="task-check" type="checkbox"
        aria-label="Complete task" ${task.completed ? "checked" : ""}>
      <div class="task-main">
        <span class="task-title">${safe(task.title)}</span>
        <div class="task-meta">
          <span class="category-pill">${safe(task.category || "General")}</span>
          <span>${task.due ? "Due " + safe(task.due) : "No due date"}</span>
        </div>
      </div>
      <span class="priority ${safe(task.priority)}">
        ${safe(task.priority[0].toUpperCase() + task.priority.slice(1))}
      </span>
      <button class="delete-task" type="button" aria-label="Delete task">×</button>
    </div>
  `).join("");

  list.classList.toggle("hidden", visible.length === 0);
  if ($("#emptyState")) {
    $("#emptyState").classList.toggle("hidden", visible.length !== 0);
  }

  updateStats();
  renderCalendar();
  renderUpcoming();
}

// Add a task
if ($("#taskForm")) {
  $("#taskForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#taskTitle").value.trim();
    if (!title) return;

    tasks.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      title,
      category: $("#taskCategory").value.trim() || "General",
      due: $("#taskDue").value || "",
      priority: $("#taskPriority").value || "medium",
      completed: false
    });

    saveTasks();
    $("#taskForm").reset();
    $("#taskForm").classList.add("hidden");
    renderTasks();
    toast("Task added successfully!");
  });
}

function openTaskForm() {
  if ($("#taskForm")) {
    $("#taskForm").classList.remove("hidden");
    $("#taskTitle").focus();
  }
}

$("#openTaskForm")?.addEventListener("click", openTaskForm);
$("#emptyAddTask")?.addEventListener("click", openTaskForm);
$("#cancelTaskForm")?.addEventListener("click", () => {
  $("#taskForm").classList.add("hidden");
});

// Complete and delete tasks
$("#taskList")?.addEventListener("change", event => {
  if (!event.target.matches(".task-check")) return;

  const item = event.target.closest(".task-item");
  const task = tasks.find(t => t.id === item.dataset.id);
  if (!task) return;

  task.completed = event.target.checked;
  saveTasks();
  renderTasks();
  toast(task.completed ? "Task completed! Great work!" : "Task reopened.");
});

$("#taskList")?.addEventListener("click", event => {
  const button = event.target.closest(".delete-task");
  if (!button) return;

  const item = button.closest(".task-item");
  tasks = tasks.filter(t => t.id !== item.dataset.id);
  saveTasks();
  renderTasks();
  toast("Task deleted.");
});

// Task filters
document.querySelectorAll(".task-tab").forEach(button => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll(".task-tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });
    renderTasks();
  });
});

// Task search
$("#taskSearch")?.addEventListener("input", event => {
  search = event.target.value;
  renderTasks();
});

// Clear completed tasks
$("#clearCompleted")?.addEventListener("click", () => {
  const before = tasks.length;
  tasks = tasks.filter(task => !task.completed);

  if (before === tasks.length) {
    toast("No completed tasks to clear.");
    return;
  }

  saveTasks();
  renderTasks();
  toast("Completed tasks cleared.");
});

// Calendar
function renderCalendar() {
  if (!$("#calendarGrid")) return;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  $("#calendarMonth").textContent = month.toLocaleDateString(undefined, {
    month: "long", year: "numeric"
  });

  const labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  let html = labels.map(day =>
    `<div class="calendar-day-label">${day}</div>`
  ).join("");

  for (let cell = 0; cell < 42; cell++) {
    const dayNumber = cell - firstDay + 1;
    const date = new Date(year, monthIndex, dayNumber);
    const key = dateKey(date);
    const outside = dayNumber < 1 || dayNumber > daysInMonth;
    const isToday = key === dateKey(new Date());
    const hasTask = tasks.some(t => t.due === key && !t.completed);

    const classes = [
      "calendar-day",
      outside ? "outside" : "",
      isToday ? "today" : "",
      key === selectedDate ? "selected" : "",
      hasTask ? "has-task" : ""
    ].filter(Boolean).join(" ");

    html += `<button type="button" class="${classes}"
      data-date="${key}">${date.getDate()}</button>`;
  }

  $("#calendarGrid").innerHTML = html;
}

$("#calendarGrid")?.addEventListener("click", event => {
  const button = event.target.closest(".calendar-day");
  if (!button) return;

  selectedDate = button.dataset.date;
  const date = new Date(selectedDate + "T12:00:00");
  month = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendar();
  renderUpcoming();
});

$("#prevMonth")?.addEventListener("click", () => {
  month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  renderCalendar();
});

$("#nextMonth")?.addEventListener("click", () => {
  month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  renderCalendar();
});

function renderUpcoming() {
  if (!$("#upcomingList")) return;

  const upcoming = tasks.filter(t =>
    !t.completed && t.due && t.due >= dateKey(new Date())
  ).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);

  $("#upcomingCount").textContent = upcoming.length + " items";
  $("#upcomingList").innerHTML = upcoming.length
    ? upcoming.map(task => `
      <div class="upcoming-item">
        <div class="upcoming-date">${safe(task.due.slice(5))}</div>
        <div class="upcoming-copy">
          <strong>${safe(task.title)}</strong>
          <small>${safe(task.category || "General")} · ${safe(task.priority)} priority</small>
        </div>
        <span class="upcoming-status"></span>
      </div>
    `).join("")
    : `<div class="upcoming-empty">No upcoming tasks yet. Add a due date to a task!</div>`;
}

// Progress chart
function renderChart() {
  if (!$("#barChart")) return;

  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;
  const max = Math.max(4, completed + pending);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  $("#barChart").innerHTML = days.map((day, i) => {
    const done = Math.max(0, completed - (i % 3));
    const todo = Math.max(0, pending - (i % 2));
    const doneHeight = Math.max(3, done / max * 100);
    const todoHeight = Math.max(3, todo / max * 100);

    return `<div class="bar-column">
      <div class="bar-pair">
        <span class="bar done" style="height:${doneHeight}%"></span>
        <span class="bar pending" style="height:${todoHeight}%"></span>
      </div>
      <span class="bar-label">${day}</span>
    </div>`;
  }).join("");
}

// Dark / light mode
function setTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  if ($("#themeIcon")) $("#themeIcon").textContent = dark ? "☾" : "☼";

  try {
    localStorage.setItem("studyflow.theme.v1", dark ? "dark" : "light");
  } catch {}
}

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("studyflow.theme.v1") || "light";
} catch {}
setTheme(savedTheme === "dark");

$("#themeToggle")?.addEventListener("click", () => {
  setTheme(!document.body.classList.contains("dark-mode"));
});

// Focus timer
function updateTimer() {
  const mins = Math.floor(timerRemaining / 60);
  const secs = timerRemaining % 60;

  if ($("#timerDisplay")) {
    $("#timerDisplay").textContent =
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  const progress = timerDuration
    ? (timerDuration - timerRemaining) / timerDuration * 360
    : 0;

  if ($("#timerRing")) {
    $("#timerRing").style.background =
      `conic-gradient(var(--mint-dark) ${progress}deg, var(--line) ${progress}deg 360deg)`;
  }

  if ($("#timerStart")) {
    $("#timerStart").textContent = timerRunning ? "Ⅱ Pause focus" : "▶ Start focus";
  }
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  updateTimer();
}

function startTimer() {
  if (timerRunning) {
    pauseTimer();
    return;
  }

  if (timerRemaining <= 0) timerRemaining = timerDuration;
  timerRunning = true;
  if ($("#timerStatus")) $("#timerStatus").textContent = "Stay focused — you've got this!";
  updateTimer();

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimer();

    if (timerRemaining <= 0) {
      pauseTimer();
      if ($("#timerStatus")) $("#timerStatus").textContent = "Session complete — well done!";

      if (timerDuration === 25 * 60) {
        focusSessions++;
        localStorage.setItem("studyflow.focusSessions.v1", focusSessions);
        updateStats();
      }

      toast("Timer complete! Take a short break.");
    }
  }, 1000);
}

$("#timerStart")?.addEventListener("click", startTimer);

$("#timerReset")?.addEventListener("click", () => {
  pauseTimer();
  timerRemaining = timerDuration;
  if ($("#timerStatus")) $("#timerStatus").textContent = "Ready when you are";
  updateTimer();
});

document.querySelectorAll(".mode-btn").forEach(button => {
  button.addEventListener("click", () => {
    pauseTimer();
    timerDuration = Number(button.dataset.minutes) * 60;
    timerRemaining = timerDuration;

    document.querySelectorAll(".mode-btn").forEach(mode => {
      mode.classList.toggle("active", mode === button);
    });

    if ($("#timerLabel")) {
      $("#timerLabel").textContent =
        Number(button.dataset.minutes) === 25 ? "FOCUS TIME" : "BREAK TIME";
    }

    if ($("#timerStatus")) $("#timerStatus").textContent = "Ready when you are";
    updateTimer();
  });
});

// Mobile sidebar and navigation
$("#mobileMenu")?.addEventListener("click", () => {
  $("#sidebar")?.classList.toggle("open");
});

document.querySelectorAll(".nav-link[href^='#']").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link[href^='#']").forEach(item => {
      item.classList.toggle("active", item === link);
    });
    $("#sidebar")?.classList.remove("open");
  });
});

// Start dashboard
updateTimer();
renderTasks();
