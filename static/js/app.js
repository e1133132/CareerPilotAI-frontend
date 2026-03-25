renderAppShell();

const resumeFile = document.getElementById("resumeFile");
const targetRoles = document.getElementById("targetRoles");
const runBtn = document.getElementById("runBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const clearResultsBtn = document.getElementById("clearResultsBtn");
const resultsList = document.getElementById("resultsList");
const emptyState = document.getElementById("emptyState");
const errorMessage = document.getElementById("errorMessage");

let currentRunId = null;
let planPollTimer = null;
let lastResultData = null;

resumeFile.addEventListener("change", () => {
  runBtn.disabled = !resumeFile.files.length;
});

clearAllBtn.addEventListener("click", () => {
  resumeFile.value = "";
  targetRoles.value = "";
  runBtn.disabled = true;
  clearResults();
});

clearResultsBtn.addEventListener("click", clearResults);

runBtn.addEventListener("click", async () => {
  if (!resumeFile.files.length) return;

  errorMessage.style.display = "none";
  runBtn.disabled = true;
  runBtn.textContent = "Running...";

  try {
    stopPlanPolling();
    const formData = new FormData();
    formData.append("resume_file", resumeFile.files[0]);
    formData.append("target_roles", targetRoles.value || "");

    const res = await fetch("/api/careerpilot/run_partial", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.detail || "Request failed");
    }

    lastResultData = data;
    currentRunId = data.run_id || null;
    renderResults(lastResultData);
    if (currentRunId && data.plan_status === "pending") {
      startPlanPolling(currentRunId);
    }
  } catch (err) {
    errorMessage.textContent = err.message || "Something went wrong";
    errorMessage.style.display = "block";
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run CareerPilot";
  }
});

function clearResults() {
  stopPlanPolling();
  resultsList.innerHTML = "";
  emptyState.style.display = "block";
  clearResultsBtn.style.display = "none";
  errorMessage.style.display = "none";
}

function renderResults(data) {
  emptyState.style.display = "none";
  clearResultsBtn.style.display = "inline-block";

  resultsList.innerHTML = `
    ${renderProfileCard(data.candidate_profile || {})}
    ${renderJobsCard(data.recommended_jobs || [])}
    ${renderSkillGapsCard(data.skill_gaps || {})}
    ${renderStudyPlanCard(data.study_plan || null, data.plan_status || "")}
  `;
}

function renderProfileCard(profile) {
  const skills = dedupe(profile.skills || []).slice(0, 24);
  const education = profile.education || [];
  const experience = profile.experience || [];
  const certifications = profile.certifications || [];
  const links = profile.links || [];

  return `
    <div class="result-card profile">
      <div class="result-card-header">
        <span>👤</span>
        <h3>Candidate Profile</h3>
      </div>
      <div class="result-card-body">
        <div class="profile-top">
          <h4>${escapeHtml(profile.name || "Candidate")}</h4>
          <p class="profile-headline">${escapeHtml(profile.headline || "")}</p>
          <div class="meta-row">
            ${links.map(link => `<span class="meta-pill">${escapeHtml(link)}</span>`).join("")}
            ${certifications.map(cert => `<span class="meta-pill">${escapeHtml(cert)}</span>`).join("")}
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Skills</h5>
          <div class="tag-list">
            ${skills.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join("")}
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Education</h5>
          <div class="timeline-list">
            ${education.map(item => `
              <div class="timeline-item">
                <div class="timeline-main">
                  <div>
                    <div class="timeline-title">${escapeHtml(item.school || "")}</div>
                    <div class="timeline-subtitle">${escapeHtml([item.degree, item.field].filter(Boolean).join(" · "))}</div>
                  </div>
                  <div class="timeline-date">${escapeHtml(item.dates || "")}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="section-block">
          <h5 class="section-title">Experience</h5>
          <div class="timeline-list">
            ${experience.map(item => `
              <div class="timeline-item">
                <div class="timeline-main">
                  <div>
                    <div class="timeline-title">${escapeHtml(item.role || "")}</div>
                    <div class="timeline-subtitle">${escapeHtml(item.company || "")}</div>
                  </div>
                  <div class="timeline-date">${escapeHtml(item.dates || "")}</div>
                </div>
                ${(item.highlights || []).length ? `
                  <div class="bullet-block">
                    <ul>
                      ${item.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("")}
                    </ul>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderJobsCard(jobs) {
  return `
    <div class="result-card jobs">
      <div class="result-card-header">
        <span>💼</span>
        <h3>Recommended Jobs</h3>
      </div>
      <div class="result-card-body">
        <div class="job-list">
          ${jobs.map(job => `
            <div class="job-item">
              <div class="job-main">
                <div>
                  <div class="job-title">${escapeHtml(job.title || "")}</div>
                  <div class="job-desc">${escapeHtml(job.description || "")}</div>
                </div>
                <div class="job-score">${Math.round((job.score || 0) * 100)}% match</div>
              </div>
              <div class="job-skill-list">
                ${(job.skills_required || []).map(skill => `
                  <span class="job-skill-tag">${escapeHtml(skill)}</span>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSkillGapsCard(gaps) {
  const matched = gaps.matched_strengths || [];
  const missing = gaps.missing_skills || [];
  const target = gaps.target_job || {};

  return `
    <div class="result-card gaps">
      <div class="result-card-header">
        <span>🧩</span>
        <h3>Skill Gaps</h3>
      </div>
      <div class="result-card-body">
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
      </div>
    </div>
  `;
}

function renderStudyPlanCard(plan, planStatus) {
  if (!plan || planStatus === "pending") {
    return `
      <div class="result-card plan">
        <div class="result-card-header">
          <span>📚</span>
          <h3>Study Plan</h3>
        </div>
        <div class="result-card-body">
          <div class="meta-row">
            <span class="meta-pill">Generating…</span>
          </div>
          <p class="timeline-subtitle">We’re building your study plan. This section will update automatically when ready.</p>
        </div>
      </div>
    `;
  }

  const phases = plan.phases || [];
  const prep = plan.interview_prep || [];
  const tips = plan.portfolio_tips || [];
  const resources = Array.isArray(plan.resources) ? plan.resources : [];
  const extraSuggestions = Array.isArray(plan.resource_suggestions) ? plan.resource_suggestions : [];

  return `
    <div class="result-card plan">
      <div class="result-card-header">
        <span>📚</span>
        <h3>Study Plan</h3>
      </div>
      <div class="result-card-body">
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
                  ${r.relevance_score != null ? `<span class="phase-weeks">score ${Number(r.relevance_score).toFixed(3)}</span>` : ""}
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
      </div>
    </div>
  `;
}

function startPlanPolling(runId) {
  stopPlanPolling();
  planPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/careerpilot/result/${encodeURIComponent(runId)}`);
      const data = await res.json();
      if (!res.ok) return;
      if (!data || data.ok !== true) return;

      // Update only when plan is ready.
      if (data.plan_status === "done" && data.study_plan) {
        lastResultData = { ...(lastResultData || {}), ...data };
        renderResults(lastResultData);
        stopPlanPolling();
      } else if (data.plan_status === "error") {
        // Stop polling on error; keep partial results.
        stopPlanPolling();
      }
    } catch (_) {
      // Ignore transient polling errors.
    }
  }, 1500);
}

function stopPlanPolling() {
  if (planPollTimer) {
    clearInterval(planPollTimer);
    planPollTimer = null;
  }
  currentRunId = null;
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
  document.body.innerHTML = `
    <div class="app-container">
      <header class="header">
        <h1>CareerPilot AI</h1>
        <p class="subtitle">Upload your resume and get job matches, skill gaps, and a study plan</p>
      </header>

      <main class="main-content">
        <section class="input-section">
          <div class="form-card">
            <div class="form-field">
              <label for="resumeFile">Resume file (.pdf)</label>
              <input id="resumeFile" type="file" accept=".pdf,application/pdf" />
              <div class="help-text">We will extract text from your PDF resume automatically.</div>
            </div>

            <div class="form-field">
              <label for="targetRoles">Target roles (optional)</label>
              <input id="targetRoles" type="text" placeholder="e.g. Data Analyst, Backend Engineer" />
              <div class="help-text">Comma-separated. Helps job matching.</div>
            </div>
          </div>

          <div id="errorMessage" class="error-message" style="display: none;"></div>

          <div class="action-buttons">
            <button class="btn btn-primary" id="runBtn" disabled>Run CareerPilot</button>
            <button class="btn btn-outline" id="clearAllBtn">Clear</button>
          </div>
        </section>

        <section class="results-section">
          <div class="results-header">
            <h2>Results</h2>
            <button class="btn btn-text" id="clearResultsBtn" style="display: none;">Clear Results</button>
          </div>

          <div class="empty-state" id="emptyState">
            <span class="empty-icon">&#128196;</span>
            <p>No results yet. Upload a resume and click Run CareerPilot.</p>
          </div>

          <div class="results-list" id="resultsList"></div>
        </section>
      </main>
    </div>
  `;
}