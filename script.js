import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
	getFirestore,
	collection,
	addDoc,
	onSnapshot,
	serverTimestamp,
	query,
	orderBy,
	limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── STATES ──
const STATES = [
	"Abia",
	"Adamawa",
	"Akwa Ibom",
	"Anambra",
	"Bauchi",
	"Bayelsa",
	"Benue",
	"Borno",
	"Cross River",
	"Delta",
	"Ebonyi",
	"Edo",
	"Ekiti",
	"Enugu",
	"FCT - Abuja",
	"Gombe",
	"Imo",
	"Jigawa",
	"Kaduna",
	"Kano",
	"Katsina",
	"Kebbi",
	"Kogi",
	"Kwara",
	"Lagos",
	"Nasarawa",
	"Niger",
	"Ogun",
	"Ondo",
	"Osun",
	"Oyo",
	"Plateau",
	"Rivers",
	"Sokoto",
	"Taraba",
	"Yobe",
	"Zamfara",
];
// document
// 	.querySelectorAll('.checkbox-item input[type="checkbox"]')
// 	.forEach((cb) => {
// 		cb.addEventListener("click", (e) => e.stopPropagation());
// 	});

function populateSelects() {
	const selects = [
		"state-select",
		"reg-state-select",
		"vol-state",
		"incident-state",
	];
	selects.forEach((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		STATES.forEach(
			(s) => (el.innerHTML += `<option value="${s}">${s}</option>`),
		);
	});
	const yearSelect = document.getElementById("year-select");
	const currentYear = new Date().getFullYear();
	for (let y = currentYear; y >= 2000; y--)
		yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
}
populateSelects();

// ── ANTI-DUPLICATE ──
function generatePersistentFingerprint() {
	const ua = navigator.userAgent;
	const screenRes = `${screen.width}x${screen.height}x${screen.colorDepth}`;
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const language = navigator.language;
	const platform = navigator.platform;
	const cpuCores = navigator.hardwareConcurrency || "unknown";
	const deviceMemory = navigator.deviceMemory || "unknown";
	const fingerprintString = `${ua}|${screenRes}|${timezone}|${language}|${platform}|${cpuCores}|${deviceMemory}`;
	let hash = 0;
	for (let i = 0; i < fingerprintString.length; i++) {
		hash = (hash << 5) - hash + fingerprintString.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}
function generateIPHash() {
	const stored = localStorage.getItem(ANTI_DUPLICATE_CONFIG.ipStorageKey);
	if (stored) return stored;
	const newIPHash = "ip_" + generatePersistentFingerprint().substring(0, 12);
	localStorage.setItem(ANTI_DUPLICATE_CONFIG.ipStorageKey, newIPHash);
	return newIPHash;
}
function hasAlreadySubmitted() {
	const storedFP = localStorage.getItem(ANTI_DUPLICATE_CONFIG.storageKey);
	const currentFP = generatePersistentFingerprint();
	const storedIP = localStorage.getItem(ANTI_DUPLICATE_CONFIG.ipStorageKey);
	const currentIP = generateIPHash();
	const hasId = localStorage.getItem(ANTI_DUPLICATE_CONFIG.submissionRecordKey);
	return (
		(storedFP && storedFP === currentFP) ||
		(storedIP && storedIP === currentIP) ||
		!!hasId
	);
}
function markAsPermanentlySubmitted(docId) {
	const fp = generatePersistentFingerprint();
	const ip = generateIPHash();
	localStorage.setItem(ANTI_DUPLICATE_CONFIG.storageKey, fp);
	localStorage.setItem(ANTI_DUPLICATE_CONFIG.ipStorageKey, ip);
	localStorage.setItem(ANTI_DUPLICATE_CONFIG.submissionRecordKey, docId);
	sessionStorage.setItem(ANTI_DUPLICATE_CONFIG.storageKey, fp);
	sessionStorage.setItem(ANTI_DUPLICATE_CONFIG.submissionRecordKey, docId);
}
function checkAndShowDuplicateWarning() {
	const warningDiv = document.getElementById("duplicate-warning");
	const btn = document.getElementById("submit-btn");
	if (hasAlreadySubmitted()) {
		warningDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:top;margin-right:0px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> <strong>You have already registered!</strong> One submission per device. If you're helping someone else, use the helper override below.`;
		warningDiv.style.display = "block";
		btn.disabled = true;
		btn.style.opacity = "0.6";
	} else {
		warningDiv.style.display = "none";
		btn.disabled = false;
		btn.style.opacity = "1";
	}
}

// ── FIREBASE ──
let db = null,
	votersCol = null,
	volunteersCol = null,
	incidentsCol = null;
let allVoters = [],
	allVolunteers = [],
	allIncidents = [];
let adminOverrideActive = false,
	adminOverrideUsed = false;

function initFirebase() {
	try {
		const app = initializeApp(FIREBASE_CONFIG);
		db = getFirestore(app);
		votersCol = collection(db, "voters");
		volunteersCol = collection(db, "volunteers");
		incidentsCol = collection(db, "incidents");

		const statusEl = document.getElementById("fb-status");

		onSnapshot(
			votersCol,
			(snap) => {
				allVoters = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
				renderVoterDashboard(allVoters);
				renderInsights(allVoters);
				updateGlobalStats();
				statusEl.innerText = "🔴 Live";
				statusEl.className = "firebase-status ok";
			},
			(err) => {
				statusEl.innerText = "Error";
				statusEl.className = "firebase-status err";
			},
		);

		onSnapshot(volunteersCol, (snap) => {
			allVolunteers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
			renderVolunteerDashboard(allVolunteers);
			updateGlobalStats();
		});

		onSnapshot(incidentsCol, (snap) => {
			allIncidents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
			renderIncidentLog(allIncidents);
			updateGlobalStats();
		});
	} catch (e) {
		console.error(e);
		document.getElementById("fb-status").innerText = "Init error";
		document.getElementById("fb-status").className = "firebase-status err";
	}
}
initFirebase();

// ── GLOBAL STATS ──
function updateGlobalStats() {
	document.getElementById("total-registered").innerText =
		allVoters.length.toLocaleString();
	document.getElementById("total-pvc").innerText = allVoters
		.filter((d) => d.pvcStatus === "yes")
		.length.toLocaleString();
	const displaced = allVoters.filter(
		(d) => d.state && d.regState && d.state !== d.regState,
	).length;
	document.getElementById("total-displaced").innerText =
		displaced.toLocaleString();
	document.getElementById("total-volunteers").innerText =
		allVolunteers.length.toLocaleString();
	document.getElementById("total-incidents").innerText =
		allIncidents.length.toLocaleString();
	document.getElementById("vol-total").innerText =
		allVolunteers.length.toLocaleString();
	document.getElementById("vol-states").innerText = new Set(
		allVolunteers.map((v) => v.state),
	).size;
}

// ── VOTER DASHBOARD ──
function renderVoterDashboard(docs) {
	const counts = {};
	docs.forEach((d) => (counts[d.state] = (counts[d.state] || 0) + 1));
	const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	const max = sorted[0]?.[1] || 1;
	const stateContainer = document.getElementById("state-list");
	stateContainer.innerHTML =
		sorted.length === 0
			? `<div style="padding:2rem;text-align:center;">No submissions yet.</div>`
			: sorted
					.map(
						([st, cnt]) =>
							`<div class="state-row"><span class="state-name">${st}</span><div class="state-bar-wrap"><div class="state-bar green" style="width:${(cnt / max) * 100}%"></div></div><span class="state-count">${cnt}</span></div>`,
					)
					.join("");

	const regMap = {};
	docs.forEach((d) => {
		if (!regMap[d.regState])
			regMap[d.regState] = { yes: 0, no: 0, processing: 0 };
		if (d.pvcStatus) regMap[d.regState][d.pvcStatus]++;
	});
	const sortedPVC = Object.entries(regMap).sort(
		(a, b) =>
			b[1].yes +
			b[1].no +
			b[1].processing -
			(a[1].yes + a[1].no + a[1].processing),
	);
	const gridDiv = document.getElementById("pvc-grid");
	gridDiv.innerHTML =
		sortedPVC.length === 0
			? `<div style="grid-column:1/-1;text-align:center;">No PVC data yet</div>`
			: sortedPVC
					.map(([state, stats]) => {
						const total = stats.yes + stats.no + stats.processing;
						const pct = total ? Math.round((stats.yes / total) * 100) : 0;
						const isAlert = pct < 50 && total > 2;
						return `<div class="pvc-card ${isAlert ? "alert" : ""}">
          <div class="pvc-state">${state}</div>
          <div class="pvc-count">${pct}%</div>
          <div class="pvc-label">${stats.yes} of ${total} have PVC</div>
          <span class="badge ${isAlert ? "badge-no" : "badge-yes"}">${isAlert ? "⚠️ low collection" : "✓ collecting"}</span>
        </div>`;
					})
					.join("");
}

// ── VOLUNTEER DASHBOARD ──
const TEAM_LABELS = {
	t1: "Tech Security",
	t2: "Voter Data",
	t3: "PVC Logistics",
	t4: "Field Watch",
	t5: "Civic Education",
	t6: "Legal & Advocacy",
};
const TEAM_ICONS = {
	t1: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-laptop-minimal-check-icon lucide-laptop-minimal-check"><path d="M2 20h20"/><path d="m9 10 2 2 4-4"/><rect x="3" y="4" width="18" height="12" rx="2"/></svg>`,
	t2: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`,
	t3: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
	t4: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
	t5: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-megaphone-icon lucide-megaphone"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/></svg>`,
	t6: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scale-icon lucide-scale"><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></svg>`,
};

function renderVolunteerDashboard(vols) {
	// State list
	const counts = {};
	vols.forEach((v) => (counts[v.state] = (counts[v.state] || 0) + 1));
	const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	const max = sorted[0]?.[1] || 1;
	const volList = document.getElementById("vol-state-list");
	volList.innerHTML =
		sorted.length === 0
			? `<div style="padding:2rem;text-align:center;color:var(--ink-light);">No volunteers yet.</div>`
			: sorted
					.map(
						([st, cnt]) =>
							`<div class="state-row"><span class="state-name">${st}</span><div class="state-bar-wrap"><div class="state-bar gold" style="width:${(cnt / max) * 100}%"></div></div><span class="state-count">${cnt}</span></div>`,
					)
					.join("");

	// Team breakdown
	const teamCounts = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0 };
	vols.forEach((v) => {
		if (teamCounts[v.team] !== undefined) teamCounts[v.team]++;
	});
	const totalVols = vols.length || 1;
	document.getElementById("vol-team-breakdown").innerHTML = Object.entries(
		teamCounts,
	)
		.map(([team, count]) => {
			const pct = Math.round((count / totalVols) * 100);
			return `<div style="margin-bottom:0.8rem;">
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem;">
        <span style="font-weight:500;">${TEAM_ICONS[team]} ${TEAM_LABELS[team]}</span>
        <span style="font-family:'DM Mono',monospace;">${count} (${pct}%)</span>
      </div>
      <div style="height:6px;background:var(--surface);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:3px;transition:width 0.6s;"></div>
      </div>
    </div>`;
		})
		.join("");

	// Field Watch role breakdown (Team 4 only)
	const t4vols = vols.filter((v) => v.team === "t4");
	const roles = {
		observer: 0,
		coordinator: 0,
		responder: 0,
		"legal-observer": 0,
	};
	t4vols.forEach((v) => {
		if (v.role && roles[v.role] !== undefined) roles[v.role]++;
	});
	const roleLabels = {
		observer: "Polling Unit Observer",
		coordinator: "Ward Coordinator",
		responder: "Incident Responder",
		"legal-observer": "Legal Observer",
	};
	const totalT4 = t4vols.length || 1;
	document.getElementById("vol-role-breakdown").innerHTML =
		t4vols.length === 0
			? `<div style="color:var(--ink-light);font-size:0.82rem;text-align:center;padding:0.5rem;">No Field Watch volunteers yet.</div>`
			: Object.entries(roles)
					.map(([role, count]) => {
						const pct = Math.round((count / totalT4) * 100);
						return `<div style="margin-bottom:0.8rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem;">
            <span style="font-weight:500;">${roleLabels[role]}</span>
            <span style="font-family:'DM Mono',monospace;">${count} (${pct}%)</span>
          </div>
          <div style="height:6px;background:var(--surface);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--green-mid);border-radius:3px;transition:width 0.6s;"></div>
          </div>
        </div>`;
					})
					.join("");

	// Admin view — now has Team column
	const volBody = document.getElementById("vol-submissions-body");
	if (volBody) {
		const recent = [...vols]
			.sort((a, b) => (b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0))
			.slice(0, 100);
		volBody.innerHTML =
			recent.length === 0
				? `<tr><td colspan="9" style="text-align:center;padding:2rem;">No volunteers yet.</td></tr>`
				: recent
						.map(
							(v) => `<tr>
          <td>${TEAM_ICONS[v.team] || ""} ${TEAM_LABELS[v.team] || v.team || "—"}</td>
          <td>${v.name || "—"}</td>
          <td>${v.phone || "—"}</td>
          <td>${v.email || "—"}</td>
          <td>${v.state || "—"}</td>
          <td>${v.lga || v.t3lga || "—"}</td>
          <td>${v.role || "—"}</td>
					<td>${v.discord || "—"}</td> 
          <td class="time-ago">${timeAgo(v.ts)}</td>
        </tr>`,
						)
						.join("");
	}
}

// ── TEAM SELECTION UI ──
window.volunteerGuard = {
	consentPromptShownAt: null,
	consentLatencyMs: null,
	consentGiven: null,
	consentFlagged: false,
	contradictionWarningShownAt: null,
	contradictionSubmitAt: null,
	changedAfterWarning: false,
	refreshedAfterWarning: false,
	unethicalResponse: null,
	rejectedByUnethicalCheck: false,
	answersLocked: false,
	answersHash: null,
	flagAcknowledged: false,
};

window.selectTeam = function (teamId) {
	if (typeof lucide !== "undefined") lucide.createIcons();
	document.getElementById("vol-team").value = teamId;
	document
		.querySelectorAll(".vol-team-fields")
		.forEach((f) => (f.style.display = "none"));
	const fields = document.getElementById(`fields-${teamId}`);
	if (fields) fields.style.display = "block";

	const subtitles = {
		t1: "Cybersecurity, dev, network & data roles",
		t2: "Registry, dashboard & survey roles",
		t3: "Field coordination & transport roles",
		t4: "Observer, coordinator & responder roles",
		t5: "Content, media, radio & translation roles",
		t6: "Legal, advocacy & policy roles",
	};
	document.getElementById("vol-form-icon").innerHTML =
		TEAM_ICONS[teamId] || "🙋";
	document.getElementById("vol-form-title").innerText =
		`${TEAM_LABELS[teamId]} — Volunteer Form`;
	document.getElementById("vol-form-subtitle").innerText =
		subtitles[teamId] || "";

	// Reset screening flow when team is selected
	window.resetVolunteerScreening();
	document.getElementById("vol-basic-step").style.display = "block";
	document.getElementById("vol-background-check").style.display = "none";
	document.getElementById("vol-details-step").style.display = "none";
	document.getElementById("vol-contradiction-warning").style.display = "none";
	document.getElementById("vol-unethical-request").style.display = "none";

	document.getElementById("vol-team-picker").style.display = "none";
	document.getElementById("vol-form-section").style.display = "block";
	window.scrollTo({
		top: document.querySelector(".tab-bar").offsetTop - 60,
		behavior: "smooth",
	});
};

window.resetVolunteerScreening = function () {
	window.volunteerGuard = {
		consentPromptShownAt: null,
		consentLatencyMs: null,
		consentGiven: null,
		consentFlagged: false,
		contradictionWarningShownAt: null,
		contradictionSubmitAt: null,
		changedAfterWarning: false,
		refreshedAfterWarning: false,
		unethicalResponse: null,
		rejectedByUnethicalCheck: false,
		answersLocked: false,
		answersHash: null,
		flagAcknowledged: false,
	};
	sessionStorage.removeItem("vol_warning_shown");
	sessionStorage.removeItem("vol_answers_hash");
	sessionStorage.removeItem("vol_answers_timestamp");
	sessionStorage.removeItem("vol_answers_locked");
	const formMsg = document.getElementById("vol-form-msg");
	if (formMsg) formMsg.textContent = "";
	const consentWarning = document.getElementById("vol-consent-warning");
	if (consentWarning) consentWarning.textContent = "";
	const unethicalResult = document.getElementById("vol-unethical-result");
	if (unethicalResult) unethicalResult.textContent = "";
};

window.continueVolunteerSignup = function () {
	const name = document.getElementById("vol-name")?.value.trim();
	const phone = document.getElementById("vol-phone")?.value.trim();
	const state = document.getElementById("vol-state")?.value;
	const meetingTime = document.getElementById("vol-meeting-time")?.value;
	const msg = document.getElementById("vol-form-msg");

	if (!name || !phone || !state || !meetingTime) {
		if (msg)
			msg.textContent =
				"Please fill your name, phone, state, and preferred check-in time.";
		return;
	}

	if (msg) msg.textContent = "";
	document.getElementById("vol-basic-step").style.display = "none";
	document.getElementById("vol-background-check").style.display = "block";
	window.volunteerGuard.consentPromptShownAt = performance.now();
};

window.handleVolunteerConsent = function (response) {
	const now = performance.now();
	const guard = window.volunteerGuard;
	guard.consentLatencyMs = Math.round(
		now - (guard.consentPromptShownAt || now),
	);
	guard.consentGiven = response === "yes";
	guard.consentFlagged =
		!guard.consentGiven || guard.consentLatencyMs > 4000;

	const warningEl = document.getElementById("vol-consent-warning");
	if (warningEl) {
		warningEl.textContent = guard.consentFlagged
			? "Consent recorded. Your application will be marked for coordinator review."
			: "Consent recorded. Proceed to the next step.";
	}

	document.getElementById("vol-background-check").style.display = "none";
	document.getElementById("vol-details-step").style.display = "block";
};

window.hashVolunteerAnswers = function (trust, vote, social) {
	const answersStr = `${trust}|${vote}|${social}`;
	let hash = 0;
	for (let i = 0; i < answersStr.length; i++) {
		hash = (hash << 5) - hash + answersStr.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
};

window.showVolunteerContradictionWarning = function () {
	const trust = document.getElementById("vol-inec-trust")?.value;
	const vote = document.querySelector('input[name="vol-votebuying"]:checked')
		?.value;
	const social = document.querySelector(
		'input[name="vol-socialmedia"]:checked',
	)?.value;
	const msg = document.getElementById("vol-form-msg");

	if (!trust || !vote || !social) {
		if (msg) msg.textContent = "Please answer the quick opinion questions.";
		return;
	}

	if (msg) msg.textContent = "";

	// Hash answers immediately and store with timestamp — IRREVERSIBLE
	const answersHash = window.hashVolunteerAnswers(trust, vote, social);
	const timestamp = Date.now();
	sessionStorage.setItem("vol_answers_hash", answersHash);
	sessionStorage.setItem("vol_answers_timestamp", timestamp);
	sessionStorage.setItem("vol_answers_locked", "true");

	window.volunteerGuard.contradictionWarningShownAt = performance.now();
	window.volunteerGuard.answersHash = answersHash;
	window.volunteerGuard.answersLocked = true;

	// Disable all opinion inputs to prevent any changes
	document.getElementById("vol-inec-trust").disabled = true;
	document.querySelectorAll('input[name="vol-votebuying"]').forEach(el => el.disabled = true);
	document.querySelectorAll('input[name="vol-socialmedia"]').forEach(el => el.disabled = true);

	// Show irreversible flag message
	const isSuspicious = parseInt(trust) > 7 && vote === "yes";
	const flagMsg = document.getElementById("vol-warning-note");

	if (isSuspicious) {
		if (flagMsg) {
			flagMsg.innerHTML = `<strong style="color: #856404;">⚠️ Processing your responses...</strong><p style="margin: 0.5rem 0 0; color: #856404; font-size: 0.9rem;">You answered that you trust INEC above 7 AND support prison for vote-buying. Our algorithm flags this combination as statistically anomalous. Your application has been logged for manual review. You will hear from us within 72 hours.</p>`;
		}
	}

	// Hide Review & Submit button from vol-details-step
	const reviewBtn = document.getElementById("vol-review-submit-btn");
	if (reviewBtn) reviewBtn.style.display = "none";
	const detailsMsg = document.getElementById("vol-form-msg");
	if (detailsMsg) detailsMsg.style.display = "none";

	// Hide all existing buttons in contradiction warning
	const oldButtons = document.querySelectorAll('#vol-contradiction-warning button');
	oldButtons.forEach(btn => btn.style.display = 'none');

	// Show only OK button
	const okBtn = document.createElement('button');
	okBtn.className = 'submit-btn gold';
	okBtn.type = 'button';
	okBtn.textContent = "OK, I'll wait for your review";
	okBtn.style.marginTop = '1rem';
	okBtn.onclick = function() {
		document.getElementById("vol-contradiction-warning").style.display = "none";
		document.getElementById("vol-unethical-request").style.display = "block";
		window.volunteerGuard.flagAcknowledged = true;
	};
	document.getElementById("vol-contradiction-warning").appendChild(okBtn);

	document.getElementById("vol-contradiction-warning").style.display = "block";
};

window.markVolunteerChangedAfterWarning = function () {
	// Answers are now locked; prevent any changes
	if (sessionStorage.getItem("vol_answers_locked")) {
		return false;
	}
};

window.showVolunteerUnethicalRequest = function () {
	window.volunteerGuard.contradictionSubmitAt = performance.now();
	document.getElementById("vol-contradiction-warning").style.display = "none";
	document.getElementById("vol-unethical-request").style.display = "block";
};

window.handleVolunteerUnethicalResponse = function (response) {
	const guard = window.volunteerGuard;
	guard.unethicalResponse = response;
	const note = document.getElementById("vol-unethical-result");

	if (response === "yes") {
		guard.rejectedByUnethicalCheck = true;
		// Hide all buttons in unethical request section
		const unethicalButtons = document.querySelectorAll('#vol-unethical-request button');
		unethicalButtons.forEach(btn => btn.style.display = 'none');
		if (note) {
			note.innerHTML = '<strong style="color: #c5192d;">❌ Application rejected</strong><p style="margin: 0.5rem 0 0; color: #856404; font-size: 0.9rem;">We only accept volunteers who refuse to spread unverified false claims. Your application has been rejected.</p>';
			note.style.display = 'block';
		}
		return;
	}

	// For "No" response — proceed with submission
	guard.unethicalResponse = response;
	if (note) {
		note.textContent = "Thank you. Submitting your volunteer application now.";
		note.style.display = 'block';
	}
	// Hide the unethical request buttons
	const unethicalButtons = document.querySelectorAll('#vol-unethical-request button');
	unethicalButtons.forEach(btn => btn.style.display = 'none');

	sessionStorage.removeItem("vol_warning_shown");

	setTimeout(() => {
		window.submitVolunteerForm();
	}, 300);
};

window.backToTeamPicker = function () {
	document.getElementById("vol-form-section").style.display = "none";
	document.getElementById("vol-team-picker").style.display = "block";
	document.getElementById("vol-team").value = "";
};

// ── INCIDENT LOG ──
function renderIncidentLog(incidents) {
	const log = document.getElementById("incident-log");
	const sorted = [...incidents].sort(
		(a, b) => (b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0),
	);
	const svColors = { 1: "s1", 2: "s2", 3: "s3" };
	log.innerHTML =
		sorted.length === 0
			? `<div style="padding:2rem;text-align:center;color:var(--ink-light);font-size:0.85rem;">No incidents reported yet.</div>`
			: sorted
					.slice(0, 30)
					.map(
						(inc) => `
        <div class="incident-row">
          <div class="incident-dot ${svColors[inc.severity] || "s1"}"></div>
          <div class="incident-body">
            <div class="incident-type-label">${inc.type || "Unknown"} · ${inc.state || "Unknown state"}, ${inc.lga || ""}</div>
            <div class="incident-desc">${inc.description ? inc.description.substring(0, 180) + (inc.description.length > 180 ? "…" : "") : "No description."}</div>
            <div class="incident-meta">${timeAgo(inc.ts)}${inc.time ? ` · reported at ${inc.time}` : ""}</div>
          </div>
        </div>
      `,
					)
					.join("");

	// State breakdown
	const stateCounts = {};
	incidents.forEach(
		(i) => (stateCounts[i.state] = (stateCounts[i.state] || 0) + 1),
	);
	const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
	const maxS = sortedStates[0]?.[1] || 1;
	const incStateList = document.getElementById("incident-state-list");
	incStateList.innerHTML =
		sortedStates.length === 0
			? `<div style="padding:1.5rem;text-align:center;color:var(--ink-light);">No data yet.</div>`
			: sortedStates
					.map(
						([st, cnt]) =>
							`<div class="state-row"><span class="state-name">${st}</span><div class="state-bar-wrap"><div class="state-bar" style="width:${(cnt / maxS) * 100}%;background:linear-gradient(90deg,var(--red),#8c2e24);"></div></div><span class="state-count">${cnt}</span></div>`,
					)
					.join("");

	// Admin view
	const incAdminBody = document.getElementById("incident-admin-body");
	if (incAdminBody) {
		incAdminBody.innerHTML =
			sorted.length === 0
				? `<tr><td colspan="8" style="text-align:center;padding:2rem;">No incidents yet.</td></tr>`
				: sorted
						.slice(0, 50)
						.map(
							(i) => `<tr>
          <td>${i.type || "—"}</td>
          <td>${i.severity === "3" ? "🔴 Urgent" : i.severity === "2" ? "🟡 Moderate" : "🟢 Low"}</td>
          <td>${i.state || "—"}</td>
          <td>${i.lga || "—"}</td>
          <td>${i.unit || "—"}</td>
          <td style="max-width:200px;white-space:normal;">${(i.description || "").substring(0, 100)}…</td>
          <td>${i.contact || "—"}</td>
          <td class="time-ago">${timeAgo(i.ts)}</td>
        </tr>`,
						)
						.join("");
	}
}

// ── INSIGHTS ──
function renderInsights(docs) {
	// Displacement
	const displacementMap = {};
	docs.forEach((d) => {
		if (d.state && d.regState && d.state !== d.regState) {
			const key = `${d.regState}→${d.state}`;
			displacementMap[key] = (displacementMap[key] || 0) + 1;
		}
	});
	const sortedDisp = Object.entries(displacementMap).sort(
		(a, b) => b[1] - a[1],
	);
	const grid = document.getElementById("displacement-grid");
	const banner = document.getElementById("displacement-banner");
	const bannerText = document.getElementById("displacement-banner-text");
	const totalDisplaced = sortedDisp.reduce((s, [, v]) => s + v, 0);

	if (totalDisplaced > 0) {
		banner.style.display = "flex";
		bannerText.innerHTML = `<strong>${totalDisplaced.toLocaleString()} voters</strong> in our database live in a different state from where their PVC is registered.
      This means they would need to travel back to their registration state to vote — or be disenfranchised.
      This data is the legal and advocacy case for cross-state PVC collection. <strong>Share it with Team 6 (Legal).</strong>`;
	}

	grid.innerHTML =
		sortedDisp.length === 0
			? `<div style="grid-column:1/-1;text-align:center;color:var(--ink-light);padding:2rem;">No cross-state data yet — will appear as registrations grow.</div>`
			: sortedDisp
					.slice(0, 24)
					.map(([key, count]) => {
						const [from, to] = key.split("→");
						return `<div class="displacement-card">
          <div class="displacement-count">${count}</div>
          <div class="displacement-detail">
            <div class="displacement-title">Registered in ${from}</div>
            <div class="displacement-sub">Currently living in <strong>${to}</strong><br/>
              <span class="displacement-arrow">Must travel to ${from} to vote →</span>
            </div>
          </div>
        </div>`;
					})
					.join("");

	// Channel breakdown
	const channels = { whatsapp: 0, twitter: 0, friend: 0, community: 0 };
	docs.forEach((d) => {
		if (!d.channels) return;
		d.channels.split(", ").forEach((c) => {
			if (channels[c] !== undefined) channels[c]++;
		});
	});
	const total = docs.length || 1;
	document.getElementById("ch-whatsapp").innerText =
		Math.round((channels.whatsapp / total) * 100) + "%";
	document.getElementById("ch-twitter").innerText =
		Math.round((channels.twitter / total) * 100) + "%";
	document.getElementById("ch-friend").innerText =
		Math.round((channels.friend / total) * 100) + "%";
	document.getElementById("ch-community").innerText =
		Math.round((channels.community / total) * 100) + "%";

	// Low PVC states
	const regMap = {};
	docs.forEach((d) => {
		if (!regMap[d.regState])
			regMap[d.regState] = { yes: 0, no: 0, processing: 0 };
		if (d.pvcStatus) regMap[d.regState][d.pvcStatus]++;
	});
	const lowPVC = Object.entries(regMap)
		.map(([state, stats]) => {
			const total = stats.yes + stats.no + stats.processing;
			const pct = total ? Math.round((stats.yes / total) * 100) : 0;
			return { state, pct, total, stats };
		})
		.filter((x) => x.total >= 2)
		.sort((a, b) => a.pct - b.pct);
	const insightsPVCGrid = document.getElementById("insights-pvc-grid");
	insightsPVCGrid.innerHTML =
		lowPVC.length === 0
			? `<div style="grid-column:1/-1;text-align:center;padding:2rem;">No data yet.</div>`
			: lowPVC
					.slice(0, 12)
					.map(
						({ state, pct, total, stats }) => `
        <div class="pvc-card ${pct < 50 ? "alert" : ""}">
          <div class="pvc-state">${state}</div>
          <div class="pvc-count">${pct}%</div>
          <div class="pvc-label">${stats.yes}/${total} have PVC · ${stats.no} still need one</div>
          <span class="badge ${pct < 50 ? "badge-no" : "badge-processing"}">${pct < 50 ? "🚨 Priority target" : "⏳ Needs attention"}</span>
        </div>`,
					)
					.join("");

	// Admin submissions table
	const tbody = document.getElementById("submissions-body");
	if (tbody) {
		const recent = [...docs]
			.sort((a, b) => (b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0))
			.slice(0, 50);
		tbody.innerHTML =
			recent.length === 0
				? `<tr><td colspan="6" style="text-align:center;">No submissions yet.</td></tr>`
				: recent
						.map((s) => {
							const cls =
								s.pvcStatus === "yes"
									? "badge-yes"
									: s.pvcStatus === "processing"
										? "badge-processing"
										: "badge-no";
							const txt =
								s.pvcStatus === "yes"
									? "Has PVC"
									: s.pvcStatus === "processing"
										? "In Progress"
										: "No PVC";
							return `<tr>
            <td>${s.fname || "—"}</td>
            <td>${s.state || "—"}</td>
            <td>${s.regState || "—"}</td>
            <td><span class="badge ${cls}">${txt}</span></td>
            <td>${s.channels || "direct"}</td>
            <td class="time-ago">${timeAgo(s.ts)}</td>
          </tr>`;
						})
						.join("");
	}
}

// ── SUBMIT: VOTER ──
window.submitVoterForm = async function () {
	const fname = document.getElementById("fname").value.trim();
	const state = document.getElementById("state-select").value;
	const regState = document.getElementById("reg-state-select").value;
	const year = document.getElementById("year-select").value;
	const pvcStatus = document.getElementById("pvc-status").value;
	if (!fname || !state || !regState || !year || !pvcStatus) {
		showMsg("form-msg", "Please fill all fields.", "error");
		return;
	}
	if (hasAlreadySubmitted() && !adminOverrideActive) {
		showMsg(
			"form-msg",
			"❌ This device has already registered. Use the helper override below.",
			"warning",
		);
		return;
	}
	if (adminOverrideActive && adminOverrideUsed) {
		showMsg(
			"form-msg",
			"Override already used. Refresh or re-enter code.",
			"warning",
		);
		return;
	}
	const btn = document.getElementById("submit-btn");
	btn.disabled = true;
	btn.innerHTML =
		'<span style="display:inline-block;width:12px;height:12px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span> Recording...';
	const channels =
		[...document.querySelectorAll('input[name="channel"]:checked')]
			.map((c) => c.value)
			.join(", ") || "direct";
	try {
		const docRef = await addDoc(votersCol, {
			fname,
			state,
			regState,
			year: parseInt(year),
			pvcStatus,
			channels,
			ts: serverTimestamp(),
			submittedByHelper: adminOverrideActive,
		});
		if (!adminOverrideActive) {
			markAsPermanentlySubmitted(docRef.id);
			showMsg(
				"form-msg",
				`✅ Registered! ${fname}, your data is permanently recorded.`,
				"success",
			);
		} else {
			showMsg(
				"form-msg",
				`✅ Assisted registration complete for ${fname}. Override deactivated.`,
				"success",
			);
			adminOverrideUsed = true;
			adminOverrideActive = false;
		}
		btn.innerHTML = "✓ Registered!";
		btn.style.background = "#0d4a2d";
		setTimeout(() => {
			btn.disabled = hasAlreadySubmitted() && !adminOverrideActive;
			btn.style.background = "";
			btn.innerHTML = "Submit My Registration";
		}, 2000);
		checkAndShowDuplicateWarning();
	} catch (e) {
		showMsg("form-msg", "Firebase error — check permissions.", "error");
		btn.disabled = false;
		btn.innerHTML = "Submit My Registration";
	}
};

// ── SUBMIT: VOLUNTEER ──
window.submitVolunteerForm = async function () {
	const name = document.getElementById("vol-name").value.trim();
	const phone = document.getElementById("vol-phone").value.trim();
	const state = document.getElementById("vol-state").value;
	const team = document.getElementById("vol-team").value;
	const email = document.getElementById("vol-email").value.trim();
	const guard = window.volunteerGuard || {};

	// Enforce screening step completion
	if (guard.consentGiven === null) {
		showMsg(
			"vol-form-msg",
			"Please complete the initial screening before submitting.",
			"error",
		);
		return;
	}
	if (guard.unethicalResponse !== "no") {
		showMsg(
			"vol-form-msg",
			"Please complete the final screening and choose not to post the false tweet.",
			"error",
		);
		return;
	}

	const DISCORD_INVITES = {
		t1: "https://discord.gg/RCnHf2sj",
		t2: "https://discord.gg/RCnHf2sj",
		t3: "https://discord.gg/ATkpnhbX",
		t4: "https://discord.gg/bNFQpuuj",
		t5: "https://discord.gg/UxFXDbZf",
		t6: "https://discord.gg/8sE6Q23U",
	};
	const discordInvite = DISCORD_INVITES[team];
	const msgEl = document.getElementById("vol-form-msg");
	if (!name || !phone || !state || !team) {
		showMsg("vol-form-msg", "Please fill name, phone and state.", "error");
		return;
	}

	const btn = document.getElementById("vol-submit-btn");
	btn.disabled = true;
	btn.innerHTML = "Submitting…";
	const experience = document.getElementById("vol-experience").value.trim();

	// Collect team-specific fields
	const extra = {};
	if (team === "t1") {
		extra.skills = [
			...document.querySelectorAll('input[name="t1-skills"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.portfolio = document.getElementById("t1-portfolio").value.trim();
		extra.availability = [
			...document.querySelectorAll('input[name="t1-avail"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
	} else if (team === "t2") {
		extra.skills = [
			...document.querySelectorAll('input[name="t2-skills"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.stateCoord =
			document.querySelector('input[name="t2-coord"]:checked')?.value || "";
		extra.languages = [
			...document.querySelectorAll('input[name="t2-lang"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
	} else if (team === "t3") {
		extra.lga = document.getElementById("t3-lga").value.trim();
		extra.vehicle =
			document.querySelector('input[name="t3-vehicle"]:checked')?.value || "";
		extra.languages = [
			...document.querySelectorAll('input[name="t3-lang"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.availability = [
			...document.querySelectorAll('input[name="t3-avail"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
	} else if (team === "t4") {
		extra.lga = document.getElementById("t4-lga").value.trim();
		extra.ward = document.getElementById("t4-ward").value.trim();
		extra.role =
			document.querySelector('input[name="t4-role"]:checked')?.value ||
			"observer";
		extra.availability = [
			...document.querySelectorAll('input[name="t4-avail"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
	} else if (team === "t5") {
		extra.skills = [
			...document.querySelectorAll('input[name="t5-skills"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.languages = [
			...document.querySelectorAll('input[name="t5-lang"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.townhall =
			document.querySelector('input[name="t5-townhall"]:checked')?.value || "";
	} else if (team === "t6") {
		extra.role =
			document.querySelector('input[name="t6-role"]:checked')?.value || "";
		extra.barNumber = document.getElementById("t6-bar").value.trim();
		extra.experience_legal = [
			...document.querySelectorAll('input[name="t6-exp"]:checked'),
		]
			.map((c) => c.value)
			.join(", ");
		extra.availability =
			document.querySelector('input[name="t6-avail"]:checked')?.value || "";
	}

	const payload = {
		name,
		phone,
		email,
		state,
		team,
		teamLabel: TEAM_LABELS[team],
		experience,
		discord: document.getElementById("vol-discord").value.trim(),
		...extra,
		ts: serverTimestamp(),
		screening: {
			consentLatencyMs: guard.consentLatencyMs,
			consentGiven: guard.consentGiven,
			consentFlagged: guard.consentFlagged,
			answersLocked: guard.answersLocked,
			answersHash: guard.answersHash,
			contradictionWarningShownAt: guard.contradictionWarningShownAt,
			contradictionSubmitAt: guard.contradictionSubmitAt,
			contradictionDecisionTimeMs:
				guard.contradictionWarningShownAt && guard.contradictionSubmitAt
					? Math.round(
							guard.contradictionSubmitAt -
								guard.contradictionWarningShownAt,
					  )
					: null,
			changedAfterWarning: guard.changedAfterWarning,
			refreshedAfterWarning: guard.refreshedAfterWarning,
			flagAcknowledged: guard.flagAcknowledged,
			unethicalResponse: guard.unethicalResponse,
		},
	};
	// console.log("Final Data being sent to Firestore:", payload);
	try {
		await addDoc(volunteersCol, payload);
		msgEl.innerHTML = `
    <strong>✅ Welcome aboard, ${name}!</strong> You've joined ${TEAM_LABELS[team]}.<br><br>
    <a href="${discordInvite}" target="_blank" 
       style="display:inline-flex;align-items:center;gap:0.5rem;background:#5865F2;color:white;
              padding:0.6rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.85rem;margin-top:0.4rem;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
      Join your ${TEAM_LABELS[team]} Discord channel →
    </a>
`;
		msgEl.className = "form-msg success";
		msgEl.style.display = "block";

		setTimeout(() => {
			if (msgEl.style.display === "block") msgEl.style.display = "none";
		}, 30000);
		// showMsg(
		// 	"vol-form-msg",
		// 	`✅ Welcome aboard, ${name}! You've joined ${TEAM_LABELS[team]}. A coordinator will contact you on WhatsApp to confirm your role and next steps.`,
		// 	"success",
		// );
		btn.innerHTML = "✓ Joined!";
		btn.style.background = "#7a4a0d";
		[
			"vol-name",
			"vol-phone",
			"vol-email",
			"vol-experience",
			"vol-discord",
			"t1-portfolio",
			"t3-lga",
			"t4-lga",
			"t4-ward",
			"t6-bar",
		].forEach((id) => {
			const el = document.getElementById(id);
			if (el) el.value = "";
		});
		document
			.querySelectorAll(
				'.vol-team-fields input[type="checkbox"], .vol-team-fields input[type="radio"]',
			)
			.forEach((el) => (el.checked = false));
		setTimeout(() => {
			btn.disabled = false;
			btn.innerHTML = "Join the Movement";
			btn.style.background = "";
		}, 4000);
	} catch (e) {
		showMsg("vol-form-msg", "Error submitting. Please try again.", "error");
		btn.disabled = false;
		btn.innerHTML = "Join the Movement";
	}
};

// ── SUBMIT: INCIDENT ──
window.submitIncidentReport = async function () {
	const type = document.getElementById("incident-type-val").value;
	const severity = document.getElementById("incident-severity-val").value;
	const state = document.getElementById("incident-state").value;
	const lga = document.getElementById("incident-lga").value.trim();
	const description = document.getElementById("incident-desc").value.trim();
	if (!type || !severity || !state || !description) {
		showMsg(
			"incident-form-msg",
			"Please select incident type, severity, state and provide a description.",
			"error",
		);
		return;
	}
	const btn = document.getElementById("incident-submit-btn");
	btn.disabled = true;
	btn.innerHTML = "Submitting…";
	const unit = document.getElementById("incident-unit").value.trim();
	const time = document.getElementById("incident-time").value;
	const contact = document.getElementById("incident-contact").value.trim();
	try {
		await addDoc(incidentsCol, {
			type,
			severity,
			state,
			lga,
			unit,
			description,
			time,
			contact,
			ts: serverTimestamp(),
		});
		showMsg(
			"incident-form-msg",
			"✅ Report submitted. Your report has been sent to the Legal team. Thank you for your courage.",
			"success",
		);
		btn.innerHTML = "✓ Submitted";
		document.getElementById("incident-desc").value = "";
		document.getElementById("incident-lga").value = "";
		document.getElementById("incident-unit").value = "";
		document.getElementById("incident-time").value = "";
		document.getElementById("incident-contact").value = "";
		document
			.querySelectorAll(".incident-type-btn")
			.forEach((b) => b.classList.remove("selected"));
		document
			.querySelectorAll(".severity-btn")
			.forEach((b) => b.classList.remove("selected"));
		document.getElementById("incident-type-val").value = "";
		document.getElementById("incident-severity-val").value = "";
		setTimeout(() => {
			btn.disabled = false;
			btn.innerHTML = "Submit Incident Report";
		}, 3000);
	} catch (e) {
		showMsg("incident-form-msg", "Error submitting. Try again.", "error");
		btn.disabled = false;
		btn.innerHTML = "Submit Incident Report";
	}
};

// ── ADMIN HELPER (VOTER FORM) ──
document.getElementById("toggleAdminBtn").addEventListener("click", () => {
	const panel = document.getElementById("adminPanel");
	panel.style.display = panel.style.display === "block" ? "none" : "block";
});
document.getElementById("unlockHelperBtn").addEventListener("click", () => {
	const code = document.getElementById("adminCode").value.trim();
	if (code === ANTI_DUPLICATE_CONFIG.adminOverrideCode) {
		adminOverrideActive = true;
		adminOverrideUsed = false;
		document.getElementById("helperStatus").innerHTML =
			"✅ Override ACTIVE — submit once for another person.";
		document.getElementById("helperStatus").style.color = "green";
		const btn = document.getElementById("submit-btn");
		btn.disabled = false;
		btn.style.opacity = "1";
		btn.style.background = "var(--gold)";
		btn.innerHTML = "🌟 SUBMIT FOR ASSISTED PERSON (Override Mode)";
		document.getElementById("duplicate-warning").style.display = "none";
		setTimeout(
			() => (document.getElementById("adminPanel").style.display = "none"),
			2000,
		);
	} else {
		document.getElementById("helperStatus").innerHTML = "❌ Invalid code.";
		document.getElementById("helperStatus").style.color = "red";
	}
});

// ── ADMIN PIN ──
window.unlockAdmin = function () {
	const pin = document.getElementById("admin-pin-input").value.trim();
	if (pin === ANTI_DUPLICATE_CONFIG.adminPIN) {
		document.getElementById("admin-gate-screen").style.display = "none";
		document.getElementById("admin-content").style.display = "block";
		renderInsights(allVoters);
		renderVolunteerDashboard(allVolunteers);
		renderIncidentLog(allIncidents);
	} else {
		document.getElementById("admin-pin-error").style.display = "block";
	}
};
window.downloadVoterSubmissions = downloadVoterSubmissions;
window.downloadVolunteerSubmissions = downloadVolunteerSubmissions;
window.downloadIncidentReports = downloadIncidentReports;
window.downloadAllData = function () {
	downloadVoterSubmissions();
	setTimeout(() => downloadVolunteerSubmissions(), 500);
	setTimeout(() => downloadIncidentReports(), 1000);
};

// ── DOWNLOAD ADMIN DOCUMENTS ──
function downloadVoterSubmissions() {
	const headers = [
		"Full Name",
		"Current State",
		"Registration State",
		"Year of Birth",
		"PVC Status",
		"Channels",
		"Submitted By Helper",
		"Timestamp",
	];

	const rows = allVoters.map((voter) => [
		voter.fname || "",
		voter.state || "",
		voter.regState || "",
		voter.year || "",
		voter.pvcStatus === "yes"
			? "Has PVC"
			: voter.pvcStatus === "processing"
				? "In Progress"
				: "No PVC",
		voter.channels || "",
		voter.submittedByHelper ? "Yes" : "No",
		voter.ts?.toDate
			? voter.ts.toDate().toISOString()
			: voter.ts
				? new Date(voter.ts).toISOString()
				: "",
	]);

	downloadCSV(headers, rows, `voter_submissions_${getDateString()}.csv`);
}

function downloadVolunteerSubmissions() {
	const headers = [
		"Name",
		"Phone",
		"Email",
		"State",
		"Team",
		"Role/Skills",
		"Experience",
		"LGA/Ward",
		"Languages",
		"Availability",
		"Timestamp",
	];

	const rows = allVolunteers.map((vol) => {
		// Extract team-specific details
		let roleOrSkills = "";
		let lgaWard = "";
		let languages = "";
		let availability = "";

		switch (vol.team) {
			case "t1": // Tech Security
				roleOrSkills = vol.skills || "";
				availability = vol.availability || "";
				break;
			case "t2": // Voter Data
				roleOrSkills = vol.skills || "";
				languages = vol.languages || "";
				break;
			case "t3": // PVC Logistics
				lgaWard = vol.lga || "";
				languages = vol.languages || "";
				availability = vol.availability || "";
				break;
			case "t4": // Field Watch
				lgaWard = `${vol.lga || ""}${vol.ward ? ` / Ward ${vol.ward}` : ""}`;
				roleOrSkills = vol.role || "";
				availability = vol.availability || "";
				break;
			case "t5": // Civic Education
				roleOrSkills = vol.skills || "";
				languages = vol.languages || "";
				break;
			case "t6": // Legal & Advocacy
				roleOrSkills = `${vol.role || ""}${vol.barNumber ? ` (Bar #: ${vol.barNumber})` : ""}`;
				availability = vol.availability || "";
				break;
		}

		return [
			vol.name || "",
			vol.phone || "",
			vol.email || "",
			vol.state || "",
			TEAM_LABELS[vol.team] || vol.team || "",
			roleOrSkills,
			vol.experience || "",
			lgaWard,
			languages,
			availability,
			vol.ts?.toDate
				? vol.ts.toDate().toISOString()
				: vol.ts
					? new Date(vol.ts).toISOString()
					: "",
		];
	});

	downloadCSV(headers, rows, `volunteer_submissions_${getDateString()}.csv`);
}

function downloadIncidentReports() {
	const severityMap = {
		1: "🟢 Low",
		2: "🟡 Moderate",
		3: "🔴 Urgent",
	};

	const headers = [
		"Type",
		"Severity",
		"State",
		"LGA",
		"Polling Unit",
		"Description",
		"Time of Incident",
		"Contact",
		"Timestamp",
	];

	const rows = allIncidents.map((inc) => [
		inc.type || "",
		severityMap[inc.severity] || inc.severity || "",
		inc.state || "",
		inc.lga || "",
		inc.unit || "",
		inc.description || "",
		inc.time || "",
		inc.contact || "",
		inc.ts?.toDate
			? inc.ts.toDate().toISOString()
			: inc.ts
				? new Date(inc.ts).toISOString()
				: "",
	]);

	downloadCSV(headers, rows, `incident_reports_${getDateString()}.csv`);
}

// Helper function to download CSV
function downloadCSV(headers, rows, filename) {
	// Escape fields and wrap in quotes if they contain commas or quotes
	const escapeCSV = (field) => {
		if (field === null || field === undefined) return "";
		const stringField = String(field);
		if (
			stringField.includes(",") ||
			stringField.includes('"') ||
			stringField.includes("\n")
		) {
			return `"${stringField.replace(/"/g, '""')}"`;
		}
		return stringField;
	};

	const csvContent = [
		headers.map(escapeCSV).join(","),
		...rows.map((row) => row.map(escapeCSV).join(",")),
	].join("\n");

	// Add BOM for UTF-8 to handle special characters
	const blob = new Blob(["\uFEFF" + csvContent], {
		type: "text/csv;charset=utf-8;",
	});
	const link = document.createElement("a");
	const url = URL.createObjectURL(blob);

	link.setAttribute("href", url);
	link.setAttribute("download", filename);
	link.style.visibility = "hidden";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// Helper function to get date string for filename
function getDateString() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Add download buttons to the admin dashboard
function addDownloadButtons() {
	// Add to the voter submissions section
	const voterAdminSection = document.querySelector(
		"#tab-content-admin .admin-section:first-child",
	);
	if (voterAdminSection) {
		const downloadBtn = document.createElement("button");
		downloadBtn.innerHTML = "📥 Download Voter Submissions (CSV)";
		downloadBtn.className = "download-btn";
		downloadBtn.onclick = downloadVoterSubmissions;
		downloadBtn.style.cssText = "margin: 1rem 0; background: var(--green-mid);";
		voterAdminSection.insertBefore(
			downloadBtn,
			voterAdminSection.querySelector(".table-wrapper"),
		);
	}

	// Add to the volunteer submissions section
	const volAdminSection = document.querySelector(
		"#tab-content-admin .admin-section:nth-child(2)",
	);
	if (volAdminSection) {
		const downloadBtn = document.createElement("button");
		downloadBtn.innerHTML = "📥 Download Volunteer Submissions (CSV)";
		downloadBtn.className = "download-btn";
		downloadBtn.onclick = downloadVolunteerSubmissions;
		downloadBtn.style.cssText = "margin: 1rem 0; background: var(--gold);";
		volAdminSection.insertBefore(
			downloadBtn,
			volAdminSection.querySelector(".table-wrapper"),
		);
	}

	// Add to the incident reports section
	const incidentAdminSection = document.querySelector(
		"#tab-content-admin .admin-section:nth-child(3)",
	);
	if (incidentAdminSection) {
		const downloadBtn = document.createElement("button");
		downloadBtn.innerHTML = "📥 Download Incident Reports (CSV)";
		downloadBtn.className = "download-btn";
		downloadBtn.onclick = downloadIncidentReports;
		downloadBtn.style.cssText = "margin: 1rem 0; background: var(--red);";
		incidentAdminSection.insertBefore(
			downloadBtn,
			incidentAdminSection.querySelector(".table-wrapper"),
		);
	}
}

// ── UI HELPERS ──
function showMsg(id, text, type) {
	const m = document.getElementById(id);
	m.innerText = text;
	m.className = `form-msg ${type}`;
	m.style.display = "block";
	setTimeout(() => {
		if (m.style.display === "block") m.style.display = "none";
	}, 6000);
}
function timeAgo(ts) {
	if (!ts) return "recent";
	const ms = ts.toMillis ? ts.toMillis() : ts;
	const diff = Date.now() - ms;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

window.selectIncidentType = function (btn, val) {
	document
		.querySelectorAll(".incident-type-btn")
		.forEach((b) => b.classList.remove("selected"));
	btn.classList.add("selected");
	document.getElementById("incident-type-val").value = val;
};
window.selectSeverity = function (btn, val) {
	document
		.querySelectorAll(".severity-btn")
		.forEach((b) => b.classList.remove("selected"));
	btn.classList.add("selected");
	document.getElementById("incident-severity-val").value = val;
};

// ── TABS ──
window.switchTab = function (name) {
	document
		.querySelectorAll(".tab-content")
		.forEach((el) => el.classList.remove("active"));
	document
		.querySelectorAll(".tab-btn")
		.forEach((el) => el.classList.remove("active"));
	document.getElementById(`tab-content-${name}`).classList.add("active");
	document.getElementById(`tab-${name}`).classList.add("active");
	window.scrollTo({
		top: document.querySelector(".tab-bar").offsetTop - 60,
		behavior: "smooth",
	});
};

// ── SMOOTH SCROLL ──
document.querySelectorAll('a[href^="#"]').forEach((a) =>
	a.addEventListener("click", (e) => {
		const target = document.querySelector(a.getAttribute("href"));
		if (target) {
			e.preventDefault();
			target.scrollIntoView({ behavior: "smooth" });
		}
	}),
);

// ── INIT ──
window.addEventListener("DOMContentLoaded", checkAndShowDuplicateWarning);
