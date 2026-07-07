const AUTH_TOKEN_KEY = "careerpilot_auth_token";
let currentUser = null;
let currentRunId = null;
let planPollTimer = null;
let lastResultData = null;

function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch (_) {
    return "";
  }
}

function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (_) {
    /* ignore */
  }
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function showView(view, authTab = "login") {
  const home = document.getElementById("viewHome");
  const auth = document.getElementById("viewAuth");
  if (!home || !auth) return;
  const isHome = view === "home";
  home.classList.toggle("is-hidden", !isHome);
  auth.classList.toggle("is-hidden", isHome);
  auth.setAttribute("aria-hidden", isHome ? "true" : "false");
  document.body.classList.toggle("auth-mode", !isHome);
  if (!isHome) {
    setAuthTab(authTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function setAuthTab(tab) {
  const isLogin = tab === "login";
  const loginPanel = document.getElementById("authLoginPanel");
  const registerPanel = document.getElementById("authRegisterPanel");
  const tabLogin = document.getElementById("authTabLogin");
  const tabRegister = document.getElementById("authTabRegister");
  const authTitle = document.getElementById("authPageTitle");
  if (loginPanel) loginPanel.hidden = !isLogin;
  if (registerPanel) registerPanel.hidden = isLogin;
  if (tabLogin) tabLogin.classList.toggle("active", isLogin);
  if (tabRegister) tabRegister.classList.toggle("active", !isLogin);
  if (authTitle) authTitle.textContent = isLogin ? "Welcome back" : "Create account";
  showAuthError("");
}

function showAuthError(msg) {
  const authError = document.getElementById("authError");
  if (!authError) return;
  authError.textContent = msg || "";
  authError.style.display = msg ? "block" : "none";
}

function updateAnonymousFieldVisibility() {
  const wrap = document.getElementById("anonymousIdField");
  const hint = document.getElementById("loggedInHint");
  if (wrap) wrap.style.display = currentUser ? "none" : "";
  if (hint) hint.style.display = currentUser ? "block" : "none";
}

function bindTopbarButtons() {
  document.getElementById("openLoginBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    showView("auth", "login");
  });
  document.getElementById("openRegisterBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    showView("auth", "register");
  });
  document.getElementById("authLogoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleLogout();
  });
}

function renderTopbar() {
  const el = document.getElementById("topbarAuth");
  if (!el) return;
  if (currentUser) {
    const initial = String(currentUser.username || "?")[0].toUpperCase();
    el.innerHTML = `
      <div class="user-chip" title="Signed in — long-term memory is tied to your account">
        <span class="user-avatar">${escapeHtml(initial)}</span>
        <span class="user-name">${escapeHtml(currentUser.username)}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="authLogoutBtn">Sign out</button>
    `;
  } else {
    el.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" id="openLoginBtn">Sign in</button>
      <button type="button" class="btn btn-primary btn-sm" id="openRegisterBtn">Register</button>
    `;
  }
  bindTopbarButtons();
  updateAnonymousFieldVisibility();
}

async function refreshAuthStatus() {
  const token = getAuthToken();
  if (!token) {
    currentUser = null;
    renderTopbar();
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("/api/auth/me", { headers: authHeaders(), signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok || !data.user) {
      setAuthToken("");
      currentUser = null;
    } else {
      currentUser = data.user;
    }
  } catch (_) {
    setAuthToken("");
    currentUser = null;
  }
  renderTopbar();
}

function handleLogout() {
  setAuthToken("");
  currentUser = null;
  renderTopbar();
  showView("home");
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  showAuthError("");
  const username = (document.getElementById("loginUsername")?.value || "").trim();
  const password = document.getElementById("loginPassword")?.value || "";
  const btn = document.getElementById("authSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || "Login failed");
    setAuthToken(data.token || data.access_token || "");
    await refreshAuthStatus();
    showView("home");
  } catch (err) {
    showAuthError(err.message || "Login failed");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  showAuthError("");
  const username = (document.getElementById("registerUsername")?.value || "").trim();
  const password = document.getElementById("registerPassword")?.value || "";
  const email = (document.getElementById("registerEmail")?.value || "").trim();
  const btn = document.getElementById("authSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email: email || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || "Registration failed");
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const loginData = await loginRes.json();
    if (loginRes.ok && (loginData.token || loginData.access_token)) {
      setAuthToken(loginData.token || loginData.access_token);
    }
    await refreshAuthStatus();
    showView("home");
  } catch (err) {
    showAuthError(err.message || "Registration failed");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function initAuth() {
  document.getElementById("authTabLogin")?.addEventListener("click", () => setAuthTab("login"));
  document.getElementById("authTabRegister")?.addEventListener("click", () => setAuthTab("register"));
  document.getElementById("authBackBtn")?.addEventListener("click", () => showView("home"));
  document.getElementById("authLoginForm")?.addEventListener("submit", handleLoginSubmit);
  document.getElementById("authRegisterForm")?.addEventListener("submit", handleRegisterSubmit);
  setAuthTab("login");
  renderTopbar();
  refreshAuthStatus();
}

function boot() {
  renderAppShell();
  initAuth();
  bindAppEvents();
}

const COLLAPSE_STORAGE_KEY = "careerpilot-card-collapsed";
const DEFAULT_COLLAPSED = {
  summary: false,
  "profile-overview": false,
  "profile-skills": false,
  "profile-education": true,
  "profile-experience": false,
  jobs: true,
  gaps: false,
  resume: false,
  explain: true,
  plan: true,
  apply: true,
  pack: false,
};

function loadCollapsedState() {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLLAPSED };
    return { ...DEFAULT_COLLAPSED, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_COLLAPSED };
  }
}

function saveCollapsedState(state) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    /* ignore */
  }
}

function collapsibleCard(id, title, icon, bodyHtml, { collapsed = false, extraClass = "" } = {}) {
  return `
    <div class="result-card collapsible ${extraClass}${collapsed ? " is-collapsed" : ""}" data-card-id="${escapeHtml(id)}">
      <button type="button" class="result-card-header collapse-toggle" aria-expanded="${collapsed ? "false" : "true"}">
        <span class="card-icon">${icon}</span>
        <h3>${escapeHtml(title)}</h3>
        <span class="collapse-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="result-card-body">${bodyHtml}</div>
    </div>
  `;
}

function bindCollapsibleCards() {
  const collapsed = loadCollapsedState();
  document.querySelectorAll(".result-card.collapsible[data-card-id]").forEach((card) => {
    const id = card.getAttribute("data-card-id");
    if (id && collapsed[id] === true) {
      card.classList.add("is-collapsed");
      const btn = card.querySelector(".collapse-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll(".collapse-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".result-card.collapsible");
      if (!card) return;
      const id = card.getAttribute("data-card-id");
      card.classList.toggle("is-collapsed");
      const isCollapsed = card.classList.contains("is-collapsed");
      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      if (id) {
        const state = loadCollapsedState();
        state[id] = isCollapsed;
        saveCollapsedState(state);
      }
    });
  });

  document.querySelectorAll(".select-job-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.getAttribute("data-job-id");
      if (!jobId || !currentRunId) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/api/careerpilot/session/${encodeURIComponent(currentRunId)}/select_job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.detail || "Failed to select job");
        lastResultData = { ...(lastResultData || {}), ...data };
        renderResults(lastResultData);
        if (data.plan_status === "pending" || data.resume_status === "pending" || data.apply_status === "pending") {
          startPlanPolling(currentRunId);
        } else {
          stopPlanPolling(false);
        }
      } catch (err) {
        const errorMessage = document.getElementById("errorMessage");
        if (errorMessage) {
          errorMessage.textContent = err.message || "Could not update target job";
          errorMessage.style.display = "block";
        }
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(".pack-download-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fmt = btn.getAttribute("data-format");
      if (!fmt || !currentRunId) return;
      btn.disabled = true;
      try {
        await downloadApplicationPack(fmt);
      } catch (err) {
        const errorMessage = document.getElementById("errorMessage");
        if (errorMessage) {
          errorMessage.textContent = err.message || "Download failed";
          errorMessage.style.display = "block";
        }
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(".pack-copy-letter-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        let text = (lastResultData && lastResultData.application_pack && lastResultData.application_pack.cover_letter_draft) || "";
        if (!text && currentRunId) {
          const res = await fetch(
            `/api/careerpilot/session/${encodeURIComponent(currentRunId)}/application_pack?format=json`
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || data.detail || "Failed to load pack");
          text = data.application_pack?.cover_letter_draft || "";
        }
        if (!text) throw new Error("No cover letter in pack yet");
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const errorMessage = document.getElementById("errorMessage");
        if (errorMessage) {
          errorMessage.textContent = err.message || "Copy failed";
          errorMessage.style.display = "block";
        }
      }
    });
  });

  document.querySelectorAll(".reject-job-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.getAttribute("data-job-id");
      if (!jobId || !currentRunId) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/api/careerpilot/session/${encodeURIComponent(currentRunId)}/reject_job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.detail || "Failed to reject job");
        lastResultData = { ...(lastResultData || {}), ...data };
        renderResults(lastResultData);
      } catch (err) {
        const errorMessage = document.getElementById("errorMessage");
        if (errorMessage) {
          errorMessage.textContent = err.message || "Could not reject job";
          errorMessage.style.display = "block";
        }
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function updateFileStatus() {
  const resumeFile = document.getElementById("resumeFile");
  const fileStatus = document.getElementById("fileStatus");
  const runBtn = document.getElementById("runBtn");
  const file = resumeFile?.files && resumeFile.files[0];
  if (fileStatus) fileStatus.textContent = file ? file.name : "No file selected";
  if (runBtn) runBtn.disabled = !file;
}

function bindAppEvents() {
  document.getElementById("chooseFileBtn")?.addEventListener("click", () => {
    document.getElementById("resumeFile")?.click();
  });
  document.getElementById("resumeFile")?.addEventListener("change", updateFileStatus);
  document.getElementById("clearAllBtn")?.addEventListener("click", () => {
    const resumeFile = document.getElementById("resumeFile");
    const targetRoles = document.getElementById("targetRoles");
    const clientIdEl = document.getElementById("clientId");
    if (resumeFile) resumeFile.value = "";
    if (targetRoles) targetRoles.value = "";
    if (clientIdEl) clientIdEl.value = "";
    updateFileStatus();
    clearResults();
  });
  document.getElementById("clearResultsBtn")?.addEventListener("click", clearResults);
  document.getElementById("runBtn")?.addEventListener("click", async () => {
    const resumeFile = document.getElementById("resumeFile");
    const targetRoles = document.getElementById("targetRoles");
    const runBtn = document.getElementById("runBtn");
    const errorMessage = document.getElementById("errorMessage");
    if (!resumeFile?.files?.length) return;

    if (errorMessage) errorMessage.style.display = "none";
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = "Running…";
    }

    try {
      stopPlanPolling();
      const formData = new FormData();
      formData.append("resume_file", resumeFile.files[0]);
      formData.append("target_roles", targetRoles?.value || "");
      const clientIdEl = document.getElementById("clientId");
      formData.append("client_id", (clientIdEl && clientIdEl.value) || "");

      const res = await fetch("/api/careerpilot/run_partial", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Request failed");

      lastResultData = data;
      currentRunId = data.run_id || null;
      renderResults(lastResultData);
      if (
        currentRunId &&
        (data.plan_status === "pending" || data.resume_status === "pending" || data.apply_status === "pending")
      ) {
        startPlanPolling(currentRunId);
      }
    } catch (err) {
      if (errorMessage) {
        errorMessage.textContent = err.message || "Something went wrong";
        errorMessage.style.display = "block";
      }
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = "Run CareerPilot";
      }
      updateFileStatus();
    }
  });
  updateFileStatus();
}

function clearResults() {
  stopPlanPolling();
  const resultsList = document.getElementById("resultsList");
  const emptyState = document.getElementById("emptyState");
  const clearResultsBtn = document.getElementById("clearResultsBtn");
  const errorMessage = document.getElementById("errorMessage");
  if (resultsList) resultsList.innerHTML = "";
  if (emptyState) emptyState.style.display = "block";
  if (clearResultsBtn) clearResultsBtn.style.display = "none";
  if (errorMessage) errorMessage.style.display = "none";
}

function renderResults(data) {
  const emptyState = document.getElementById("emptyState");
  const clearResultsBtn = document.getElementById("clearResultsBtn");
  const resultsList = document.getElementById("resultsList");
  if (emptyState) emptyState.style.display = "none";
  if (clearResultsBtn) clearResultsBtn.style.display = "inline-block";
  if (!resultsList) return;

  resultsList.innerHTML = `
    ${renderSummaryCard(data)}
    ${renderProfileCards(data.candidate_profile || {})}
    ${renderJobsCard(data.recommended_jobs || [], data.session_memory || {})}
    ${renderSkillGapsCard(data.skill_gaps || {})}
    ${renderResumeSuggestionsCard(data.resume_suggestions || null, data.resume_status || "")}
    ${renderExplainabilityCard(resolveExplainability(data), data.plan_status || "")}
    ${renderStudyPlanCard(data.study_plan || null, data.plan_status || "", data.skip_study_plan)}
    ${renderApplyStrategyCard(data.apply_strategy || null, data.apply_status || "")}
    ${renderApplicationPackCard(data.application_pack || null, data.resume_status || "", data.apply_status || "")}
  `;
  bindCollapsibleCards();
}

function renderSummaryCard(data) {
  const routing = data.routing_decision || {};
  const session = data.session_memory || {};
  const notes = []
    .concat(routing.notes || [])
    .concat((routing.skip_reason && data.skip_study_plan) ? [`Study plan: ${routing.skip_reason}`] : []);
  const planStatus = data.plan_status || "—";
  const resumeStatus = data.resume_status || "—";
  const applyStatus = data.apply_status || "—";
  const selected = session.selected_job_title || "—";
  const memory = data.user_memory || {};
  const rejectedCount = (memory.rejected_job_ids || []).length;
  const preferredRoles = (memory.preferred_target_roles || []).slice(0, 3);
  const latestStep = data.latest_step_message || "";
  const completedSteps = data.completed_steps != null ? Number(data.completed_steps) : null;
  const pipelineDriver = data.pipeline_driver || "";

  return collapsibleCard(
    "summary",
    "Run Summary",
    "📋",
    `
      <div class="meta-row">
        <span class="meta-pill">Plan: ${escapeHtml(planStatus)}</span>
        <span class="meta-pill">Resume tips: ${escapeHtml(resumeStatus)}</span>
        <span class="meta-pill">Apply strategy: ${escapeHtml(applyStatus)}</span>
        <span class="meta-pill">Target job: ${escapeHtml(selected)}</span>
        ${data.user_id ? `<span class="meta-pill">User: ${escapeHtml(String(data.user_id).slice(0, 8))}…</span>` : ""}
        ${routing.top_score != null ? `<span class="meta-pill">Top score: ${Number(routing.top_score).toFixed(2)}</span>` : ""}
        ${routing.low_match ? `<span class="meta-pill warn">Low match</span>` : ""}
        ${completedSteps != null && completedSteps > 0 ? `<span class="meta-pill">Steps: ${completedSteps}</span>` : ""}
        ${pipelineDriver ? `<span class="meta-pill">${escapeHtml(pipelineDriver)}</span>` : ""}
      </div>
      ${latestStep ? `<p class="timeline-subtitle step-live"><strong>Latest:</strong> ${escapeHtml(latestStep)}</p>` : ""}
      ${preferredRoles.length ? `<p class="timeline-subtitle">Remembered roles: ${preferredRoles.map((r) => escapeHtml(r)).join(", ")}</p>` : ""}
      ${rejectedCount ? `<p class="timeline-subtitle">${rejectedCount} job(s) marked not interested (hidden from future ranking).</p>` : ""}
      ${notes.length ? `<ul class="summary-notes">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : `<p class="timeline-subtitle">Supervisor routed the pipeline based on match quality and skill gaps.</p>`}
    `,
    { collapsed: loadCollapsedState().summary, extraClass: "summary" }
  );
}

/**
 * Merge pipeline_trace from explainability with full_state (run_partial); handle older backends.
 * Fallback events and limitations are not shown in the UI (API may still return them).
 */
function resolveExplainability(data) {
  const raw = data.explainability;
  const fs = data.full_state;

  let trace = [];

  if (raw && typeof raw === "object" && Array.isArray(raw.pipeline_trace)) {
    trace = raw.pipeline_trace;
  }

  if (!trace.length && fs && typeof fs === "object" && Array.isArray(fs.pipeline_trace) && fs.pipeline_trace.length) {
    trace = fs.pipeline_trace;
  }

  const backendSentExplainability = data.explainability !== undefined && data.explainability !== null;
  const showMissingBackendHint = trace.length === 0 && !backendSentExplainability;

  return {
    pipeline_trace: trace,
    showMissingBackendHint
  };
}

/** Map internal state keys to user-facing labels (not raw snake_case). */
const OUTPUT_KEY_LABELS = {
  candidate_profile: "Candidate profile",
  resume_evidence: "Resume evidence",
  job_matches: "Recommended jobs",
  skill_gaps: "Skill gaps",
  study_plan: "Study plan",
  messages: "Messages"
};

function humanizeOutputKey(key) {
  const k = String(key ?? "").trim();
  if (!k) return "";
  if (OUTPUT_KEY_LABELS[k]) return OUTPUT_KEY_LABELS[k];
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const AGENT_LABELS = {
  resume_analysis: "Resume analysis",
  job_matching: "Job matching",
  skill_gap: "Skill gap analysis",
  resume_optimizer: "Resume optimizer",
  study_planning: "Study planning"
};

function humanizeAgentName(agentId) {
  const a = String(agentId ?? "").trim();
  if (!a) return "";
  if (AGENT_LABELS[a]) return AGENT_LABELS[a];
  return a
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function renderExplainabilityCard(resolved, planStatus) {
  const stageLabel = (s) => {
    const m = {
      intake: "Intake",
      resume: "Resume",
      match: "Match",
      gap: "Gaps",
      optimize: "Resume",
      plan: "Plan",
      done: "Done"
    };
    return m[s] || s || "—";
  };

  if (resolved.showMissingBackendHint) {
    return collapsibleCard(
      "explain",
      "How We Analyzed This",
      "🔍",
      `<p class="explain-empty-message">No analysis steps are available yet. Make sure the CareerPilot backend is up to date and the Flask app points to it (BACKEND_URL), then try again.</p>`,
      { collapsed: loadCollapsedState().explain, extraClass: "explain" }
    );
  }

  const trace = resolved.pipeline_trace || [];

  const pendingHint =
    planStatus === "pending"
      ? `<p class="explain-pending-hint">Study plan is still generating; the trace will include the planning step when ready.</p>`
      : "";

  const traceHtml = trace.length
    ? trace
        .map((step, i) => {
          const keysRaw = Array.isArray(step.output_keys) ? step.output_keys : [];
          const keys = keysRaw.filter((k) => String(k) !== "messages");
          const keysHtml = keys.length
            ? `<div class="trace-keys"><span class="trace-keys-label">This step produced:</span>${keys.map((k) => `<span class="trace-key-pill">${escapeHtml(humanizeOutputKey(k))}</span>`).join("")}</div>`
            : "";
          const ms = step.duration_ms != null ? `<span class="trace-meta">${Number(step.duration_ms).toFixed(0)} ms</span>` : "";
          const ts = step.timestamp ? `<span class="trace-meta">${escapeHtml(step.timestamp)}</span>` : "";
          const agentLine = humanizeAgentName(step.agent);
          return `
            <div class="trace-step">
              <div class="trace-step-head">
                <span class="trace-step-num">${i + 1}</span>
                <div class="trace-step-titles">
                  <div class="trace-step-title">${escapeHtml(stageLabel(step.stage))}${agentLine ? ` · ${escapeHtml(agentLine)}` : ""}</div>
                  ${step.summary ? `<div class="trace-step-summary">${escapeHtml(step.summary)}</div>` : ""}
                </div>
                <div class="trace-step-meta">${ms}${ts}</div>
              </div>
              ${step.rationale ? `<div class="trace-rationale"><strong>Why</strong><p>${escapeHtml(step.rationale)}</p></div>` : ""}
              ${keysHtml}
            </div>
          `;
        })
        .join("")
    : `<p class="timeline-subtitle">No pipeline trace in this response.</p>`;

  return collapsibleCard(
    "explain",
    "How We Analyzed This",
    "🔍",
    `
      <div class="result-card-body-inner">
        ${pendingHint}
        <div class="section-block">
          <h5 class="section-title">Pipeline trace</h5>
          <div class="trace-list">${traceHtml}</div>
        </div>
      </div>
    `,
    { collapsed: loadCollapsedState().explain, extraClass: "explain" }
  );
}

function renderProfileCards(profile) {
  const cards = [
    renderProfileOverviewCard(profile),
    renderProfileSkillsCard(profile),
    renderProfileEducationCard(profile),
    renderProfileExperienceCard(profile),
  ].filter(Boolean);
  return cards.join("");
}

function renderProfileOverviewCard(profile) {
  const certifications = profile.certifications || [];
  const links = profile.links || [];

  return collapsibleCard(
    "profile-overview",
    "Profile Overview",
    "👤",
    `
        <div class="profile-top">
          <h4>${escapeHtml(profile.name || "Candidate")}</h4>
          <p class="profile-headline">${escapeHtml(profile.headline || "")}</p>
          <div class="meta-row">
            ${links.map((link) => `<span class="meta-pill">${escapeHtml(link)}</span>`).join("")}
            ${certifications.map((cert) => `<span class="meta-pill">${escapeHtml(cert)}</span>`).join("")}
          </div>
        </div>
    `,
    { collapsed: loadCollapsedState()["profile-overview"], extraClass: "profile profile-overview" }
  );
}

function renderProfileSkillsCard(profile) {
  const skills = dedupe(profile.skills || []).slice(0, 24);
  if (!skills.length) return "";

  return collapsibleCard(
    "profile-skills",
    "Skills",
    "🛠",
    `
        <div class="tag-list">
          ${skills.map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join("")}
        </div>
    `,
    { collapsed: loadCollapsedState()["profile-skills"], extraClass: "profile profile-skills" }
  );
}

function renderProfileEducationCard(profile) {
  const education = profile.education || [];
  if (!education.length) return "";

  return collapsibleCard(
    "profile-education",
    "Education",
    "🎓",
    `
        <div class="timeline-list">
          ${education
            .map(
              (item) => `
              <div class="timeline-item">
                <div class="timeline-main">
                  <div>
                    <div class="timeline-title">${escapeHtml(item.school || "")}</div>
                    <div class="timeline-subtitle">${escapeHtml([item.degree, item.field].filter(Boolean).join(" · "))}</div>
                  </div>
                  <div class="timeline-date">${escapeHtml(item.dates || "")}</div>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
    `,
    { collapsed: loadCollapsedState()["profile-education"], extraClass: "profile profile-education" }
  );
}

function renderProfileExperienceCard(profile) {
  const experience = profile.experience || [];
  if (!experience.length) return "";

  return collapsibleCard(
    "profile-experience",
    "Experience",
    "💼",
    `
        <div class="timeline-list">
          ${experience
            .map(
              (item) => `
              <div class="timeline-item">
                <div class="timeline-main">
                  <div>
                    <div class="timeline-title">${escapeHtml(item.role || "")}</div>
                    <div class="timeline-subtitle">${escapeHtml(item.company || "")}</div>
                  </div>
                  <div class="timeline-date">${escapeHtml(item.dates || "")}</div>
                </div>
                ${
                  (item.highlights || []).length
                    ? `
                  <div class="bullet-block">
                    <ul>
                      ${item.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
                    </ul>
                  </div>
                `
                    : ""
                }
              </div>
            `
            )
            .join("")}
        </div>
    `,
    { collapsed: loadCollapsedState()["profile-experience"], extraClass: "profile profile-experience" }
  );
}

function sourceBadge(source) {
  const s = String(source || "internal").toLowerCase();
  if (s === "web") return `<span class="meta-pill source-web">Web</span>`;
  return `<span class="meta-pill source-internal">Internal</span>`;
}

function formatRelevanceLabel(score, method) {
  if (score == null || score === "") return "";
  const m = String(method || "").toLowerCase();
  const label = m.includes("qdrant") ? "vector" : (m.includes("keyword") ? "keyword" : (m || "retrieval"));
  return `relevance ${Number(score).toFixed(2)} · ${escapeHtml(label)}`;
}

function renderJobsCard(jobs, sessionMemory) {
  const selectedId = String(sessionMemory.selected_job_id || "");
  const canSelect = Boolean(currentRunId);
  const rejectedIds = new Set(
    ((lastResultData && lastResultData.user_memory && lastResultData.user_memory.rejected_job_ids) || []).map(String)
  );

  return collapsibleCard(
    "jobs",
    `Recommended Jobs (${jobs.length})`,
    "💼",
    `
        <p class="timeline-subtitle">Internal CareerPilot postings plus optional web listings. Select a job for gap analysis.</p>
        <div class="job-list">
          ${jobs.map(job => {
            const jobId = String(job.id || "");
            const isSelected = jobId && jobId === selectedId;
            const isRejected = rejectedIds.has(jobId);
            const company = job.company ? `<div class="timeline-subtitle">${escapeHtml(job.company)}</div>` : "";
            return `
            <div class="job-item${isSelected ? " job-item-selected" : ""}${isRejected ? " job-item-rejected" : ""}">
              <div class="job-main">
                <div>
                  <div class="job-title">${escapeHtml(job.title || "")}</div>
                  ${sourceBadge(job.source)}
                  ${company}
                  <div class="job-desc">${escapeHtml(job.description || "")}</div>
                  ${job.match_explanation ? `<div class="job-explanation">${escapeHtml(job.match_explanation)}</div>` : ""}
                </div>
                <div class="job-score">${Math.round((job.score || 0) * 100)}% match</div>
              </div>
              <div class="job-skill-list">
                ${(job.skills_required || []).map(skill => `
                  <span class="job-skill-tag">${escapeHtml(skill)}</span>
                `).join("")}
              </div>
              ${canSelect ? `
                <div class="job-actions">
                  <button type="button" class="btn btn-outline select-job-btn" data-job-id="${escapeHtml(jobId)}" ${isSelected ? "disabled" : ""}>
                    ${isSelected ? "Selected for gap analysis" : "Use for gap analysis"}
                  </button>
                  <button type="button" class="btn btn-text reject-job-btn" data-job-id="${escapeHtml(jobId)}" ${isRejected ? "disabled" : ""}>
                    ${isRejected ? "Not interested" : "Not interested"}
                  </button>
                </div>
              ` : ""}
            </div>
          `;
          }).join("")}
        </div>
    `,
    { collapsed: loadCollapsedState().jobs, extraClass: "jobs" }
  );
}

function renderSkillGapsCard(gaps) {
  const matched = gaps.matched_strengths || [];
  const missing = gaps.missing_skills || [];
  const target = gaps.target_job || {};

  return collapsibleCard(
    "gaps",
    "Skill Gaps",
    "🧩",
    `
        <div class="section-block">
          <h5 class="section-title">Target Role</h5>
          <div class="meta-row">
            <span class="meta-pill">${escapeHtml(target.title || "Not available")}</span>
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Matched Strengths</h5>
          <div class="gap-list">
            ${matched.length
              ? matched.map(skill => `<span class="gap-tag matched">${escapeHtml(skill)}</span>`).join("")
              : `<span class="meta-pill">No direct matches found</span>`
            }
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Missing Skills</h5>
          <div class="gap-list">
            ${missing.length
              ? missing.map(item => `<span class="gap-tag missing">${escapeHtml(item.skill)}</span>`).join("")
              : `<span class="meta-pill">No major gaps detected</span>`
            }
          </div>
        </div>
    `,
    { collapsed: loadCollapsedState().gaps, extraClass: "gaps" }
  );
}

function renderResumeSuggestionsCard(suggestions, resumeStatus) {
  if (resumeStatus === "pending" || (!suggestions && resumeStatus !== "skipped")) {
    return collapsibleCard(
      "resume",
      "Resume Suggestions",
      "✍️",
      `
        <div class="meta-row"><span class="meta-pill">Generating…</span></div>
        <p class="timeline-subtitle">Tailoring bullet rewrites and ATS keywords for your selected job.</p>
      `,
      { collapsed: loadCollapsedState().resume, extraClass: "resume" }
    );
  }

  if (!suggestions) {
    return collapsibleCard(
      "resume",
      "Resume Suggestions",
      "✍️",
      `<p class="timeline-subtitle">No resume suggestions for this run.</p>`,
      { collapsed: loadCollapsedState().resume, extraClass: "resume" }
    );
  }

  const target = suggestions.target_job || {};
  const bullets = suggestions.experience_bullets || [];
  const keywords = suggestions.ats_keywords || [];
  const notes = suggestions.notes || [];

  return collapsibleCard(
    "resume",
    "Resume Suggestions",
    "✍️",
    `
      <div class="section-block">
        <h5 class="section-title">Target Role</h5>
        <span class="meta-pill">${escapeHtml(target.title || "—")}</span>
      </div>

      ${suggestions.summary_tip ? `
      <div class="section-block">
        <h5 class="section-title">Summary / Headline Tip</h5>
        <p class="timeline-subtitle">${escapeHtml(suggestions.summary_tip)}</p>
      </div>` : ""}

      ${keywords.length ? `
      <div class="section-block">
        <h5 class="section-title">ATS Keywords</h5>
        <div class="tag-list">
          ${keywords.map((k) => `<span class="skill-tag">${escapeHtml(k)}</span>`).join("")}
        </div>
      </div>` : ""}

      <div class="section-block">
        <h5 class="section-title">Experience Bullet Rewrites</h5>
        <div class="resume-bullets">
          ${bullets.length ? bullets.map((b) => `
            <div class="resume-bullet-item">
              <div class="timeline-title">${escapeHtml(b.section || "Experience")}</div>
              ${b.original ? `<p class="resume-original"><strong>Original:</strong> ${escapeHtml(b.original)}</p>` : ""}
              ${b.suggested ? `<p class="resume-suggested"><strong>Suggested:</strong> ${escapeHtml(b.suggested)}</p>` : ""}
              ${b.rationale ? `<p class="timeline-subtitle">${escapeHtml(b.rationale)}</p>` : ""}
            </div>
          `).join("") : `<p class="timeline-subtitle">No bullet rewrites generated.</p>`}
        </div>
      </div>

      ${notes.length ? `
      <div class="section-block">
        <h5 class="section-title">Notes</h5>
        <ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
      </div>` : ""}
    `,
    { collapsed: loadCollapsedState().resume, extraClass: "resume" }
  );
}

function renderStudyPlanCard(plan, planStatus, skipStudyPlan) {
  if (planStatus === "skipped" || skipStudyPlan) {
    return collapsibleCard(
      "plan",
      "Study Plan",
      "📚",
      `<p class="timeline-subtitle">Supervisor skipped study plan generation (no high-priority gaps or weak match). Select another job or refine target roles to regenerate.</p>`,
      { collapsed: loadCollapsedState().plan, extraClass: "plan" }
    );
  }

  if (!plan || planStatus === "pending") {
    return collapsibleCard(
      "plan",
      "Study Plan",
      "📚",
      `
          <div class="meta-row">
            <span class="meta-pill">Generating…</span>
          </div>
          <p class="timeline-subtitle">We’re building your study plan. This section will update automatically when ready.</p>
      `,
      { collapsed: false, extraClass: "plan" }
    );
  }

  const phases = plan.phases || [];
  const prep = plan.interview_prep || [];
  const tips = plan.portfolio_tips || [];
  const resources = Array.isArray(plan.resources) ? plan.resources : [];
  const extraSuggestions = Array.isArray(plan.resource_suggestions) ? plan.resource_suggestions : [];

  return collapsibleCard(
    "plan",
    "Study Plan",
    "📚",
    `
        <div class="meta-row">
          <span class="meta-pill">${escapeHtml(String(plan.timeline_weeks || 0))} weeks</span>
        </div>

        ${resources.length ? `
        <div class="section-block">
          <h5 class="section-title">Learning resources (RAG)</h5>
          <div class="phase-list">
            ${resources.map(r => `
              <div class="phase-item">
                <div class="phase-header">
                  <h6 class="phase-name">${escapeHtml(r.title || r.id || "Resource")}</h6>
                  ${r.relevance_score != null ? `<span class="phase-weeks">${formatRelevanceLabel(r.relevance_score, r.match_method)}</span>` : ""}
                  ${sourceBadge(r.source)}
                </div>
                ${(r.focus_skills || []).length ? `
                  <div class="phase-block">
                    <strong>Skills</strong>
                    <div class="tag-list">
                      ${(r.focus_skills || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("")}
                    </div>
                  </div>
                ` : ""}
                ${r.summary ? `<div class="phase-block"><strong>Summary</strong><p class="timeline-subtitle">${escapeHtml(r.summary)}</p></div>` : ""}
                ${(r.resource_hints || []).length ? `
                  <div class="phase-block">
                    <strong>Resource hints</strong>
                    <ul>${(r.resource_hints || []).map(h => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

        ${extraSuggestions.length ? `
        <div class="section-block">
          <h5 class="section-title">Extra suggestions (model)</h5>
          <ul>
            ${extraSuggestions.map(s => `
              <li>
                <strong>${escapeHtml(s.title || "")}</strong>
                ${s.notes ? ` — ${escapeHtml(s.notes)}` : ""}
                ${(s.focus_skills || []).length ? ` (${(s.focus_skills || []).map(escapeHtml).join(", ")})` : ""}
              </li>
            `).join("")}
          </ul>
        </div>
        ` : ""}

        <div class="section-block">
          <h5 class="section-title">Phases</h5>
          <div class="phase-list">
            ${phases.map(phase => `
              <div class="phase-item">
                <div class="phase-header">
                  <h6 class="phase-name">${escapeHtml(phase.name || "")}</h6>
                  <span class="phase-weeks">Weeks ${(phase.weeks || []).join(" - ")}</span>
                </div>

                <div class="phase-block">
                  <strong>Topics</strong>
                  <div class="tag-list">
                    ${(phase.topics || []).map(topic => `<span class="skill-tag">${escapeHtml(topic)}</span>`).join("")}
                  </div>
                </div>

                <div class="phase-block">
                  <strong>Goals</strong>
                  <ul>${(phase.goals || []).map(g => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
                </div>

                <div class="phase-block">
                  <strong>Practice</strong>
                  <ul>${(phase.practice || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
                </div>

                ${phase.project ? `
                  <div class="phase-block">
                    <strong>${escapeHtml(phase.project.title || "Project")}</strong>
                    <ul>
                      <li>${escapeHtml(phase.project.description || "")}</li>
                      ${(phase.project.deliverables || []).map(d => `<li>${escapeHtml(d)}</li>`).join("")}
                    </ul>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Interview Prep</h5>
          <ul>${prep.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>

        <div class="section-block">
          <h5 class="section-title">Portfolio Tips</h5>
          <ul>${tips.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
    `,
    { collapsed: loadCollapsedState().plan, extraClass: "plan" }
  );
}

function readinessClass(level) {
  const v = String(level || "").toLowerCase();
  if (v === "high") return "readiness-high";
  if (v === "medium") return "readiness-medium";
  return "readiness-low";
}

function renderApplyStrategyCard(strategy, applyStatus) {
  if (applyStatus === "pending" || (!strategy && applyStatus !== "skipped")) {
    return collapsibleCard(
      "apply",
      "Apply Strategy",
      "🎯",
      `
        <div class="meta-row"><span class="meta-pill">Generating…</span></div>
        <p class="timeline-subtitle">Prioritizing applications, cover letter hooks, and follow-up checklist.</p>
      `,
      { collapsed: loadCollapsedState().apply, extraClass: "apply" }
    );
  }

  if (applyStatus === "skipped" && !strategy) {
    return collapsibleCard(
      "apply",
      "Apply Strategy",
      "🎯",
      `<p class="timeline-subtitle">Apply strategist is disabled for this run.</p>`,
      { collapsed: loadCollapsedState().apply, extraClass: "apply" }
    );
  }

  if (!strategy) return "";

  const priority = strategy.priority_applications || [];
  const hooks = strategy.cover_letter_hooks || [];
  const checklist = strategy.follow_up_checklist || [];
  const notes = strategy.notes || [];
  const target = strategy.target_job || {};

  return collapsibleCard(
    "apply",
    "Apply Strategy",
    "🎯",
    `
      <div class="section-block">
        <h5 class="section-title">Primary target</h5>
        <span class="meta-pill">${escapeHtml(target.title || "—")}</span>
      </div>

      <div class="section-block">
        <h5 class="section-title">Priority applications</h5>
        <div class="apply-priority-list">
          ${priority.length ? priority.map((item) => `
            <div class="apply-priority-item">
              <div class="apply-priority-head">
                <span class="apply-rank">#${escapeHtml(String(item.rank || ""))}</span>
                <strong>${escapeHtml(item.title || "")}</strong>
                ${item.company ? `<span class="timeline-subtitle">${escapeHtml(item.company)}</span>` : ""}
                <span class="meta-pill ${readinessClass(item.readiness)}">${escapeHtml(item.readiness || "—")}</span>
              </div>
              <p class="timeline-subtitle">${escapeHtml(item.reason || "")}</p>
            </div>
          `).join("") : `<span class="meta-pill">No applications ranked</span>`}
        </div>
      </div>

      ${hooks.length ? `
        <div class="section-block">
          <h5 class="section-title">Cover letter hooks</h5>
          <ul>${hooks.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
        </div>
      ` : ""}

      ${checklist.length ? `
        <div class="section-block">
          <h5 class="section-title">Follow-up checklist</h5>
          <ul>${checklist.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
        </div>
      ` : ""}

      ${strategy.timing_advice ? `
        <div class="section-block">
          <h5 class="section-title">Timing</h5>
          <p class="timeline-subtitle">${escapeHtml(strategy.timing_advice)}</p>
        </div>
      ` : ""}

      ${notes.length ? `
        <div class="section-block">
          <h5 class="section-title">Notes</h5>
          <ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>
      ` : ""}
    `,
    { collapsed: loadCollapsedState().apply, extraClass: "apply" }
  );
}

async function downloadApplicationPack(format) {
  if (!currentRunId) throw new Error("No active run");
  const session = (lastResultData && lastResultData.session_memory) || {};
  const jobId = session.selected_job_id ? String(session.selected_job_id) : "";
  let url = `/api/careerpilot/session/${encodeURIComponent(currentRunId)}/application_pack?format=${encodeURIComponent(format)}`;
  if (jobId) url += `&job_id=${encodeURIComponent(jobId)}`;

  const res = await fetch(url);
  if (!res.ok) {
    let detail = "Download failed";
    try {
      const err = await res.json();
      detail = err.error || err.detail || detail;
    } catch (_) {
      /* binary or empty */
    }
    throw new Error(detail);
  }

  if (format === "json") {
    const data = await res.json();
    lastResultData = { ...(lastResultData || {}), application_pack: data.application_pack };
    const blob = new Blob([JSON.stringify(data.application_pack, null, 2)], { type: "application/json" });
    triggerBlobDownload(blob, "careerpilot_application_pack.json");
    return;
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=\"?([^\";]+)\"?/);
  const filename = match ? match[1] : (format === "zip" ? "careerpilot_pack.zip" : "careerpilot_pack.md");
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function renderApplicationPackCard(pack, resumeStatus, applyStatus) {
  if (!currentRunId) return "";

  if (resumeStatus === "pending") {
    return collapsibleCard(
      "pack",
      "Application Pack",
      "📦",
      `
        <div class="meta-row"><span class="meta-pill">Waiting for resume tips…</span></div>
        <p class="timeline-subtitle">Pack includes tailored bullets, cover letter, follow-up email, and checklist.</p>
      `,
      { collapsed: loadCollapsedState().pack, extraClass: "pack" }
    );
  }

  const job = (pack && pack.job) || {};
  const resume = (pack && pack.resume_section) || {};
  const letterPreview = pack && pack.cover_letter_draft
    ? String(pack.cover_letter_draft).split("\n").slice(0, 5).join("\n")
    : "";
  const canDownload = resumeStatus === "done" || resumeStatus === "skipped";

  if (!canDownload) return "";

  return collapsibleCard(
    "pack",
    "Application Pack",
    "📦",
    `
      <p class="timeline-subtitle">Human-in-the-loop apply: download materials, review, then submit on the employer site yourself.</p>
      <div class="meta-row">
        <span class="meta-pill">${escapeHtml(job.title || "Target role")}</span>
        ${job.company ? `<span class="meta-pill">${escapeHtml(job.company)}</span>` : ""}
        ${applyStatus === "pending" ? `<span class="meta-pill">Strategy still loading — pack uses resume tips now</span>` : ""}
      </div>

      ${resume.summary_tip ? `
        <div class="section-block">
          <h5 class="section-title">Summary tip</h5>
          <p class="timeline-subtitle">${escapeHtml(resume.summary_tip)}</p>
        </div>
      ` : ""}

      ${letterPreview ? `
        <div class="section-block">
          <h5 class="section-title">Cover letter preview</h5>
          <pre class="pack-preview">${escapeHtml(letterPreview)}…</pre>
        </div>
      ` : ""}

      <div class="pack-actions">
        <button type="button" class="btn btn-primary pack-download-btn" data-format="zip">Download ZIP</button>
        <button type="button" class="btn btn-outline pack-download-btn" data-format="markdown">Download Markdown</button>
        <button type="button" class="btn btn-outline pack-copy-letter-btn">Copy cover letter</button>
      </div>
      <p class="help-text pack-help">ZIP contains README.md, cover_letter.md, follow_up_email.txt, resume_suggestions.md, checklist.md, pack.json</p>
    `,
    { collapsed: loadCollapsedState().pack, extraClass: "pack" }
  );
}

function startPlanPolling(runId) {
  stopPlanPolling(false);
  planPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/careerpilot/result/${encodeURIComponent(runId)}`);
      const data = await res.json();
      if (!res.ok) return;
      if (!data || data.ok !== true) return;

      const planPending = data.plan_status === "pending";
      const resumePending = data.resume_status === "pending";
      const applyPending = data.apply_status === "pending";
      const planSettled = ["done", "skipped", "error"].includes(data.plan_status);
      const resumeSettled = ["done", "skipped", "error"].includes(data.resume_status);
      const applySettled = ["done", "skipped", "error"].includes(data.apply_status);

      if (
        data.resume_suggestions ||
        resumeSettled ||
        data.study_plan ||
        planSettled ||
        data.apply_strategy ||
        applySettled ||
        data.application_pack ||
        data.latest_step_message
      ) {
        lastResultData = { ...(lastResultData || {}), ...data };
        renderResults(lastResultData);
      }

      if (!planPending && !resumePending && !applyPending) {
        stopPlanPolling(false);
      } else if (data.plan_status === "error" || data.apply_status === "error") {
        stopPlanPolling(false);
      }
    } catch (_) {
      // Ignore transient polling errors.
    }
  }, 1500);
}

function stopPlanPolling(clearRunId = true) {
  if (planPollTimer) {
    clearInterval(planPollTimer);
    planPollTimer = null;
  }
  if (clearRunId) {
    currentRunId = null;
  }
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const key = String(item).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAppShell() {
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <button type="button" class="brand" id="brandHomeBtn" aria-label="CareerPilot home">
            <span class="brand-mark">CP</span>
            <span class="brand-text">
              <strong>CareerPilot</strong>
              <small>AI Career Copilot</small>
            </span>
          </button>
          <nav class="topbar-auth" id="topbarAuth" aria-label="Account">
            <button type="button" class="btn btn-ghost btn-sm" id="openLoginBtn">Sign in</button>
            <button type="button" class="btn btn-primary btn-sm" id="openRegisterBtn">Register</button>
          </nav>
        </div>
      </header>

      <div id="viewHome" class="page-view">
        <div class="app-container">
          <section class="hero">
            <div class="hero-badge">Agentic Career Workflow</div>
            <h1 class="hero-title">Upload your resume. Match roles. Close skill gaps.</h1>
            <p class="hero-subtitle">Job matching, gap analysis, study plans, resume tips, and apply strategy — in one run.</p>
            <div class="hero-pills">
              <span class="hero-pill">Resume parsing</span>
              <span class="hero-pill">Vector search</span>
              <span class="hero-pill">RAG study plans</span>
              <span class="hero-pill">Long-term memory</span>
            </div>
          </section>

          <main class="main-stack">
            <section class="panel panel-input">
              <div class="form-card glass">
                <div class="panel-head">
                  <h2>Get started</h2>
                  <p>Upload your resume and optional target roles to run the full career pipeline.</p>
                </div>

                <div class="form-field">
                  <label for="resumeFile">Resume file</label>
                  <div class="file-picker">
                    <input id="resumeFile" class="sr-only-file-input" type="file" accept=".pdf,application/pdf" />
                    <button type="button" class="btn btn-outline" id="chooseFileBtn">Choose PDF</button>
                    <span id="fileStatus" class="file-status">No file selected</span>
                  </div>
                </div>

                <div id="loggedInHint" class="logged-in-banner" style="display: none;">
                  <span class="banner-icon">✓</span>
                  Signed in — preferences and rejected jobs are saved to your account
                </div>

                <div class="form-fields-row">
                  <div class="form-field" id="anonymousIdField">
                    <label for="clientId">Guest ID (optional)</label>
                    <input id="clientId" type="text" placeholder="When not signed in, e.g. demo-user" />
                  </div>

                  <div class="form-field">
                    <label for="targetRoles">Target roles (optional)</label>
                    <input id="targetRoles" type="text" placeholder="e.g. Data Analyst, Backend Engineer" />
                    <div class="help-text">Comma-separated</div>
                  </div>
                </div>

                <div id="errorMessage" class="error-message" style="display: none;"></div>

                <div class="action-buttons">
                  <button class="btn btn-primary btn-lg" id="runBtn" disabled>Run CareerPilot</button>
                  <button class="btn btn-outline" id="clearAllBtn">Clear</button>
                </div>
              </div>
            </section>

            <section class="panel panel-results">
              <div class="results-header">
                <div>
                  <h2>Results</h2>
                  <p class="results-sub">Updates appear as each pipeline step completes</p>
                </div>
                <button class="btn btn-text" id="clearResultsBtn" style="display: none;">Clear results</button>
              </div>

              <div class="empty-state" id="emptyState">
                <div class="empty-icon-wrap">📄</div>
                <p>No results yet</p>
                <span class="empty-hint">Upload a resume and click Run CareerPilot</span>
              </div>

              <div class="results-list" id="resultsList"></div>
            </section>
          </main>
        </div>
      </div>

      <div id="viewAuth" class="page-view page-view--auth is-hidden">
        <div class="auth-backdrop">
          <div class="auth-panel glass">
            <button type="button" class="auth-back" id="authBackBtn">
              <span aria-hidden="true">←</span> Back to home
            </button>
            <div class="auth-panel-head">
              <div class="auth-logo">CP</div>
              <h2 id="authPageTitle">Welcome back</h2>
              <p class="auth-lead">Sign in to bind long-term memory to your account</p>
            </div>
            <div id="authError" class="error-message auth-error" style="display: none;"></div>
            <div class="auth-tabs">
              <button type="button" class="auth-tab active" id="authTabLogin">Sign in</button>
              <button type="button" class="auth-tab" id="authTabRegister">Register</button>
            </div>
            <div id="authLoginPanel">
              <form id="authLoginForm" class="auth-form">
                <div class="form-field">
                  <label for="loginUsername">Username</label>
                  <input id="loginUsername" type="text" autocomplete="username" required placeholder="At least 3 characters" />
                </div>
                <div class="form-field">
                  <label for="loginPassword">Password</label>
                  <input id="loginPassword" type="password" autocomplete="current-password" required placeholder="At least 6 characters" />
                </div>
                <button type="submit" class="btn btn-primary btn-lg btn-block" id="authSubmitBtn">Sign in</button>
              </form>
            </div>
            <div id="authRegisterPanel" hidden>
              <form id="authRegisterForm" class="auth-form">
                <div class="form-field">
                  <label for="registerUsername">Username</label>
                  <input id="registerUsername" type="text" autocomplete="username" required minlength="3" placeholder="At least 3 characters" />
                </div>
                <div class="form-field">
                  <label for="registerEmail">Email (optional)</label>
                  <input id="registerEmail" type="email" autocomplete="email" placeholder="name@example.com" />
                </div>
                <div class="form-field">
                  <label for="registerPassword">Password</label>
                  <input id="registerPassword" type="password" autocomplete="new-password" required minlength="6" placeholder="At least 6 characters" />
                </div>
                <button type="submit" class="btn btn-primary btn-lg btn-block">Create account</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("brandHomeBtn")?.addEventListener("click", () => showView("home"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}