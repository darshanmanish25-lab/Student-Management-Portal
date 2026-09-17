// ---------------------------------------------------------------------------
// Student Register - frontend logic (vanilla JS, no build step)
// Talks to the Flask REST API defined in config.js (API_BASE_URL)
// ---------------------------------------------------------------------------

const els = {
  tableBody: document.getElementById("studentTableBody"),
  emptyState: document.getElementById("emptyState"),
  recordCount: document.getElementById("recordCount"),
  searchInput: document.getElementById("searchInput"),
  departmentFilter: document.getElementById("departmentFilter"),
  yearFilter: document.getElementById("yearFilter"),
  statusBanner: document.getElementById("statusBanner"),

  openAddBtn: document.getElementById("openAddBtn"),
  overlay: document.getElementById("overlay"),
  formPanel: document.getElementById("formPanel"),
  formPanelTitle: document.getElementById("formPanelTitle"),
  studentForm: document.getElementById("studentForm"),
  closePanelBtn: document.getElementById("closePanelBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  submitBtn: document.getElementById("submitBtn"),

  studentId: document.getElementById("studentId"),
  rollNo: document.getElementById("rollNo"),
  name: document.getElementById("name"),
  department: document.getElementById("department"),
  year: document.getElementById("year"),
  cgpa: document.getElementById("cgpa"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),

  confirmOverlay: document.getElementById("confirmOverlay"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
};

let allStudents = [];      // last full fetch, used to populate department filter
let pendingDeleteId = null;
let searchDebounceTimer = null;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    /* no body */
  }

  if (!res.ok) {
    const message =
      (body && (body.errors ? body.errors.join(" ") : body.error)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

const api = {
  list: (params = "") => apiRequest(`/students${params}`),
  get: (id) => apiRequest(`/students/${id}`),
  create: (data) => apiRequest(`/students`, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/students/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => apiRequest(`/students/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderStudents(students) {
  els.tableBody.innerHTML = "";

  if (students.length === 0) {
    els.emptyState.hidden = false;
    els.recordCount.textContent = "0 records";
    return;
  }
  els.emptyState.hidden = true;
  els.recordCount.textContent = `${students.length} record${students.length === 1 ? "" : "s"}`;

  const frag = document.createDocumentFragment();
  students.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-roll">${escapeHtml(s.roll_no)}</td>
      <td class="cell-name">${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.department)}</td>
      <td><span class="badge-year">Yr ${s.year}</span></td>
      <td class="cell-cgpa">${s.cgpa != null ? s.cgpa.toFixed(2) : "—"}</td>
      <td class="cell-muted">${s.email ? escapeHtml(s.email) : "—"}</td>
      <td class="cell-muted">${s.phone ? escapeHtml(s.phone) : "—"}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button type="button" class="edit" data-id="${s.id}">Edit</button>
          <button type="button" class="delete" data-id="${s.id}">Delete</button>
        </div>
      </td>
    `;
    frag.appendChild(tr);
  });
  els.tableBody.appendChild(frag);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function populateDepartmentFilter(students) {
  const current = els.departmentFilter.value;
  const departments = [...new Set(students.map((s) => s.department).filter(Boolean))].sort();

  els.departmentFilter.innerHTML = '<option value="">All departments</option>';
  departments.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    els.departmentFilter.appendChild(opt);
  });
  if (departments.includes(current)) els.departmentFilter.value = current;
}

function showStatus(message, type = "success") {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner status-banner--${type}`;
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => {
    els.statusBanner.hidden = true;
  }, 3500);
}

// ---------------------------------------------------------------------------
// Data loading (with search + filters)
// ---------------------------------------------------------------------------
async function loadStudents({ keepDeptOptions = false } = {}) {
  const search = els.searchInput.value.trim();
  const department = els.departmentFilter.value;
  const year = els.yearFilter.value;

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (department) params.set("department", department);
  if (year) params.set("year", year);
  const qs = params.toString() ? `?${params.toString()}` : "";

  try {
    const students = await api.list(qs);
    renderStudents(students);

    if (!keepDeptOptions) {
      // refresh department dropdown from an unfiltered fetch so options don't shrink
      if (!search && !department && !year) {
        allStudents = students;
        populateDepartmentFilter(allStudents);
      } else if (allStudents.length === 0) {
        const full = await api.list("");
        allStudents = full;
        populateDepartmentFilter(allStudents);
      }
    }
  } catch (err) {
    showStatus(err.message || "Could not load students.", "error");
  }
}

// ---------------------------------------------------------------------------
// Form panel (add / edit)
// ---------------------------------------------------------------------------
function clearFieldErrors() {
  document.querySelectorAll(".field__error").forEach((el) => (el.textContent = ""));
}

function openPanel(mode, student = null) {
  clearFieldErrors();
  els.studentForm.reset();
  els.studentId.value = "";

  if (mode === "edit" && student) {
    els.formPanelTitle.textContent = "Edit student";
    els.submitBtn.textContent = "Save changes";
    els.studentId.value = student.id;
    els.rollNo.value = student.roll_no ?? "";
    els.name.value = student.name ?? "";
    els.department.value = student.department ?? "";
    els.year.value = student.year ?? "";
    els.cgpa.value = student.cgpa ?? "";
    els.email.value = student.email ?? "";
    els.phone.value = student.phone ?? "";
  } else {
    els.formPanelTitle.textContent = "Add student";
    els.submitBtn.textContent = "Save student";
  }

  els.overlay.hidden = false;
  els.formPanel.hidden = false;
  els.formPanel.setAttribute("aria-hidden", "false");
  els.rollNo.focus();
}

function closePanel() {
  els.overlay.hidden = true;
  els.formPanel.hidden = true;
  els.formPanel.setAttribute("aria-hidden", "true");
}

function clientSideValidate(payload) {
  const errors = {};
  if (!payload.roll_no.trim()) errors.roll_no = "Roll number is required.";
  if (!payload.name.trim()) errors.name = "Name is required.";
  if (!payload.department.trim()) errors.department = "Department is required.";
  if (!payload.year) errors.year = "Year is required.";
  if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (payload.phone && !/^\d{10}$/.test(payload.phone)) {
    errors.phone = "Phone must be exactly 10 digits.";
  }
  if (payload.cgpa !== "" && (Number(payload.cgpa) < 0 || Number(payload.cgpa) > 10)) {
    errors.cgpa = "CGPA must be between 0 and 10.";
  }
  return errors;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  clearFieldErrors();

  const payload = {
    roll_no: els.rollNo.value.trim(),
    name: els.name.value.trim(),
    department: els.department.value.trim(),
    year: els.year.value,
    cgpa: els.cgpa.value.trim(),
    email: els.email.value.trim(),
    phone: els.phone.value.trim(),
  };

  const clientErrors = clientSideValidate(payload);
  if (Object.keys(clientErrors).length > 0) {
    Object.entries(clientErrors).forEach(([field, msg]) => {
      const el = document.querySelector(`[data-error-for="${field}"]`);
      if (el) el.textContent = msg;
    });
    return;
  }

  // convert empty optional fields to null-friendly values for the API
  const body = {
    roll_no: payload.roll_no,
    name: payload.name,
    department: payload.department,
    year: Number(payload.year),
    cgpa: payload.cgpa === "" ? null : Number(payload.cgpa),
    email: payload.email || null,
    phone: payload.phone || null,
  };

  const id = els.studentId.value;
  els.submitBtn.disabled = true;
  try {
    if (id) {
      await api.update(id, body);
      showStatus("Student record updated.");
    } else {
      await api.create(body);
      showStatus("Student added to the register.");
    }
    closePanel();
    await loadStudents();
  } catch (err) {
    showStatus(err.message || "Could not save student.", "error");
  } finally {
    els.submitBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
function openConfirm(id, name) {
  pendingDeleteId = id;
  els.confirmMessage.textContent = `Remove ${name} from the register? This can't be undone.`;
  els.confirmOverlay.hidden = false;
  els.confirmDialog.hidden = false;
}

function closeConfirm() {
  pendingDeleteId = null;
  els.confirmOverlay.hidden = true;
  els.confirmDialog.hidden = true;
}

async function handleConfirmDelete() {
  if (!pendingDeleteId) return;
  try {
    await api.remove(pendingDeleteId);
    showStatus("Student removed from the register.");
    closeConfirm();
    await loadStudents();
  } catch (err) {
    showStatus(err.message || "Could not delete student.", "error");
    closeConfirm();
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
els.openAddBtn.addEventListener("click", () => openPanel("add"));
els.closePanelBtn.addEventListener("click", closePanel);
els.cancelBtn.addEventListener("click", closePanel);
els.overlay.addEventListener("click", closePanel);
els.studentForm.addEventListener("submit", handleFormSubmit);

els.confirmCancelBtn.addEventListener("click", closeConfirm);
els.confirmOverlay.addEventListener("click", closeConfirm);
els.confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

els.tableBody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("button.edit");
  const deleteBtn = e.target.closest("button.delete");

  if (editBtn) {
    const id = editBtn.dataset.id;
    try {
      const student = await api.get(id);
      openPanel("edit", student);
    } catch (err) {
      showStatus(err.message || "Could not load student.", "error");
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const row = allStudents.find((s) => String(s.id) === String(id));
    openConfirm(id, row ? row.name : "this student");
  }
});

els.searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => loadStudents({ keepDeptOptions: true }), 300);
});
els.departmentFilter.addEventListener("change", () => loadStudents({ keepDeptOptions: true }));
els.yearFilter.addEventListener("change", () => loadStudents({ keepDeptOptions: true }));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!els.formPanel.hidden) closePanel();
    if (!els.confirmDialog.hidden) closeConfirm();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
loadStudents();
