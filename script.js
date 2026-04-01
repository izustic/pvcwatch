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
				const newIPHash =
					"ip_" + generatePersistentFingerprint().substring(0, 12);
				localStorage.setItem(ANTI_DUPLICATE_CONFIG.ipStorageKey, newIPHash);
				return newIPHash;
			}
			function hasAlreadySubmitted() {
				const storedFP = localStorage.getItem(ANTI_DUPLICATE_CONFIG.storageKey);
				const currentFP = generatePersistentFingerprint();
				const storedIP = localStorage.getItem(
					ANTI_DUPLICATE_CONFIG.ipStorageKey,
				);
				const currentIP = generateIPHash();
				const hasId = localStorage.getItem(
					ANTI_DUPLICATE_CONFIG.submissionRecordKey,
				);
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
				sessionStorage.setItem(
					ANTI_DUPLICATE_CONFIG.submissionRecordKey,
					docId,
				);
			}
			function checkAndShowDuplicateWarning() {
				const warningDiv = document.getElementById("duplicate-warning");
				const btn = document.getElementById("submit-btn");
				if (hasAlreadySubmitted()) {
					warningDiv.innerHTML = `⚠️ <strong>You have already registered!</strong> One submission per device. If you're helping someone else, use the helper override below.`;
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
					document.getElementById("fb-status").className =
						"firebase-status err";
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
				t1: "💻",
				t2: "📊",
				t3: "🚐",
				t4: "👁️",
				t5: "📢",
				t6: "⚖️",
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
				document.getElementById("vol-team-breakdown").innerHTML =
					Object.entries(teamCounts)
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
						.sort(
							(a, b) => (b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0),
						)
						.slice(0, 100);
					volBody.innerHTML =
						recent.length === 0
							? `<tr><td colspan="8" style="text-align:center;padding:2rem;">No volunteers yet.</td></tr>`
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
          <td class="time-ago">${timeAgo(v.ts)}</td>
        </tr>`,
									)
									.join("");
				}
			}

			// ── TEAM SELECTION UI ──
			window.selectTeam = function (teamId) {
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
				document.getElementById("vol-form-icon").innerText =
					TEAM_ICONS[teamId] || "🙋";
				document.getElementById("vol-form-title").innerText =
					`${TEAM_LABELS[teamId]} — Volunteer Form`;
				document.getElementById("vol-form-subtitle").innerText =
					subtitles[teamId] || "";

				document.getElementById("vol-team-picker").style.display = "none";
				document.getElementById("vol-form-section").style.display = "block";
				window.scrollTo({
					top: document.querySelector(".tab-bar").offsetTop - 60,
					behavior: "smooth",
				});
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
				const sortedStates = Object.entries(stateCounts).sort(
					(a, b) => b[1] - a[1],
				);
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
						.sort(
							(a, b) => (b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0),
						)
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
				if (!name || !phone || !state || !team) {
					showMsg(
						"vol-form-msg",
						"Please fill name, phone and state.",
						"error",
					);
					return;
				}

				const btn = document.getElementById("vol-submit-btn");
				btn.disabled = true;
				btn.innerHTML = "Submitting…";
				const experience = document
					.getElementById("vol-experience")
					.value.trim();

				// Collect team-specific fields
				const extra = {};
				if (team === "t1") {
					extra.skills = [
						...document.querySelectorAll('input[name="t1-skills"]:checked'),
					]
						.map((c) => c.value)
						.join(", ");
					extra.portfolio = document
						.getElementById("t1-portfolio")
						.value.trim();
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
						document.querySelector('input[name="t2-coord"]:checked')?.value ||
						"";
					extra.languages = [
						...document.querySelectorAll('input[name="t2-lang"]:checked'),
					]
						.map((c) => c.value)
						.join(", ");
				} else if (team === "t3") {
					extra.lga = document.getElementById("t3-lga").value.trim();
					extra.vehicle =
						document.querySelector('input[name="t3-vehicle"]:checked')?.value ||
						"";
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
						document.querySelector('input[name="t5-townhall"]:checked')
							?.value || "";
				} else if (team === "t6") {
					extra.role =
						document.querySelector('input[name="t6-role"]:checked')?.value ||
						"";
					extra.barNumber = document.getElementById("t6-bar").value.trim();
					extra.experience_legal = [
						...document.querySelectorAll('input[name="t6-exp"]:checked'),
					]
						.map((c) => c.value)
						.join(", ");
					extra.availability =
						document.querySelector('input[name="t6-avail"]:checked')?.value ||
						"";
				}

				const payload = {
					name,
					phone,
					email,
					state,
					team,
					teamLabel: TEAM_LABELS[team],
					experience,
					...extra,
					ts: serverTimestamp(),
				};
				// console.log("Final Data being sent to Firestore:", payload);
				try {
					await addDoc(volunteersCol, payload);
					showMsg(
						"vol-form-msg",
						`✅ Welcome aboard, ${name}! You've joined ${TEAM_LABELS[team]}. A coordinator will contact you on WhatsApp to confirm your role and next steps.`,
						"success",
					);
					btn.innerHTML = "✓ Joined!";
					btn.style.background = "#7a4a0d";
					[
						"vol-name",
						"vol-phone",
						"vol-email",
						"vol-experience",
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
					showMsg(
						"vol-form-msg",
						"Error submitting. Please try again.",
						"error",
					);
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
				const description = document
					.getElementById("incident-desc")
					.value.trim();
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
				const contact = document
					.getElementById("incident-contact")
					.value.trim();
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
			document
				.getElementById("toggleAdminBtn")
				.addEventListener("click", () => {
					const panel = document.getElementById("adminPanel");
					panel.style.display =
						panel.style.display === "block" ? "none" : "block";
				});
			document
				.getElementById("unlockHelperBtn")
				.addEventListener("click", () => {
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
							() =>
								(document.getElementById("adminPanel").style.display = "none"),
							2000,
						);
					} else {
						document.getElementById("helperStatus").innerHTML =
							"❌ Invalid code.";
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