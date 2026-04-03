const form = document.getElementById("brief-form");
const generateBtn = document.getElementById("generate-btn");
const statusEl = document.getElementById("status");
const outputEmpty = document.getElementById("output-empty");
const outputRendered = document.getElementById("output-rendered");
const copyMdBtn = document.getElementById("copy-md-btn");
const downloadMdBtn = document.getElementById("download-md-btn");
const dataStatusEl = document.getElementById("data-status");
const loadTemplateBtn = document.getElementById("load-template");
const downloadJsonBtn = document.getElementById("download-json");

let songsDb = [];
let templateData = {};
let latestMarkdown = "";

function setStatus(message, kind = "") {
  statusEl.textContent = message || "";
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function setDataStatus(message, kind = "") {
  dataStatusEl.textContent = message;
  dataStatusEl.style.background = kind === "good" ? "rgba(47, 107, 67, 0.1)" : "rgba(168, 90, 40, 0.1)";
  dataStatusEl.style.color = kind === "good" ? "var(--good)" : "var(--accent-strong)";
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function splitRecentSongs(value) {
  return value.split(/\n|,|、/g).map((item) => item.trim()).filter(Boolean);
}

function normalizeBool(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "是", "有", "需要"].includes(text);
}

function normalizeRecentSongs(value) {
  if (Array.isArray(value)) {
    const items = [];
    value.forEach((entry) => {
      if (typeof entry === "string") {
        items.push(...entry.split(/[\t,\n、/]+/g));
      }
    });
    return new Set(items.map((item) => item.trim()).filter(Boolean));
  }
  if (typeof value === "string") {
    return new Set(value.split(/[\t,\n、/]+/g).map((item) => item.trim()).filter(Boolean));
  }
  return new Set();
}

function textBlob(brief) {
  return [
    brief.service_type,
    brief.season_or_special_day,
    brief.congregation_profile,
    brief.devotion_theme,
    brief.prayer_insight,
    brief.church_condition,
    brief.sermon_title,
    brief.sermon_scripture,
    brief.sermon_summary,
  ].filter(Boolean).join(" ");
}

function inferThemeKeywords(brief) {
  const blob = textBlob(brief);
  const keywordMap = {
    "謙卑": ["謙卑", "驕傲"],
    "恩典": ["恩典"],
    "信靠": ["信靠", "交託", "倚靠", "看顧"],
    "基督": ["耶穌", "基督"],
    "救恩": ["救恩", "十架", "十字架", "福音"],
    "平安": ["平安", "安息"],
    "順服": ["順服"],
    "悔改": ["悔改"],
    "盼望": ["盼望"],
  };
  const found = [];
  Object.entries(keywordMap).forEach(([tag, needles]) => {
    if (needles.some((needle) => blob.includes(needle))) {
      found.push(tag);
    }
  });
  return found.length ? found : ["基督", "恩典"];
}

function serviceFlags(brief) {
  const profile = String(brief.congregation_profile || "");
  const serviceType = String(brief.service_type || "");
  const season = String(brief.season_or_special_day || "");
  return {
    gospel: serviceType.includes("福音") || season.includes("福音"),
    seekers: profile.includes("慕道") || normalizeBool(brief.seekers_expected),
    german: profile.includes("德國") || normalizeBool(brief.german_attendees_expected),
    guestSpeaker: String(brief.speaker_type || "").toLowerCase().includes("guest") || String(brief.speaker_type || "").includes("外來"),
  };
}

function normalizePosition(code) {
  const value = String(code || "");
  if (["song_1", "song_2"].includes(value)) return value;
  if (["第三首/回應", "third_or_response", "song_3", "第三首"].includes(value)) return "song_3";
  if (["禱告/回應", "奉獻/回應", "response_song"].includes(value)) return "response_song";
  return value;
}

function songScore(song, position, tags, recent, flags) {
  let score = 0;
  const songPosition = normalizePosition(song.recommended_position_code);
  if (songPosition === position) {
    score += 4;
  } else if (["song_3", "response_song"].includes(position) && ["song_2", "song_3", "response_song"].includes(songPosition)) {
    score += 2;
  }

  const familiarity = String(song.familiarity_code || "").toLowerCase();
  if (familiarity === "high") {
    score += 4;
  } else if (["medium", "中高"].includes(familiarity) || String(song.familiarity_code || "") === "中高") {
    score += 2;
  } else {
    score -= 1;
  }

  const seeker = String(song.seeker_friendly_code || "").toLowerCase();
  if (flags.gospel || flags.seekers) {
    if (seeker === "yes") score += 3;
    else if (seeker === "maybe") score += 1;
    else score -= 2;
  }

  const name = String(song.song_name_zh || "");
  if (recent.has(name)) score -= 6;

  const haystack = [
    song.theme_tags_zh,
    song.special_use_tags_zh,
    song.recommended_usage_zh,
    song.secondary_category_zh,
  ].map((value) => String(value || "")).join(" ");
  const overlap = tags.filter((tag) => haystack.includes(tag)).length;
  score += overlap * 3;

  if (flags.german && position === "song_1" && familiarity === "high") score += 1;
  return score;
}

function chooseSong(songs, position, tags, recent, flags, used) {
  return songs
    .filter((song) => song.song_name_zh && !used.has(song.song_name_zh))
    .map((song) => ({ song, score: songScore(song, position, tags, recent, flags) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.song.song_name_zh).localeCompare(String(b.song.song_name_zh), "zh-Hant");
    })[0]?.song || null;
}

function buildSet(brief, songs) {
  const flags = serviceFlags(brief);
  const tags = inferThemeKeywords(brief);
  const recent = normalizeRecentSongs(brief.recent_songs || []);
  const used = new Set();
  const chosen = [];

  ["song_1", "song_2", "song_3"].forEach((position) => {
    const song = chooseSong(songs, position, tags, recent, flags, used);
    if (song) {
      chosen.push([position, song]);
      used.add(song.song_name_zh);
    }
  });

  let response;
  const responseGiven = String(brief.response_song_given_by_pastor || "").trim();
  if (responseGiven) {
    response = {
      song_name_zh: responseGiven,
      recommended_position_code: "response_song",
      theme_tags_zh: "牧者指定",
      familiarity_code: "unknown",
      seeker_friendly_code: "unknown",
    };
  } else {
    response = chooseSong(songs, "response_song", tags, recent, flags, used);
  }

  return { chosen, response, tags, flags };
}

function reasonForSong(song, position, tags, flags) {
  const reasons = [];
  if (position === "song_1") reasons.push("適合作為聚集會眾的開場");
  else if (position === "song_2") reasons.push("適合帶領會眾進入敬拜");
  else if (position === "song_3") reasons.push("適合放在信息前後作為預備或回應");
  else reasons.push("適合作為回應詩歌承接信息");

  const theme = String(song.theme_tags_zh || "").trim();
  if (theme && theme !== "待人工補充") reasons.push(`主題包含${theme}`);

  const familiarity = String(song.familiarity_code || "").toLowerCase();
  if (familiarity === "high") reasons.push("熟悉度高");
  else if (["medium", "中高"].includes(familiarity) || String(song.familiarity_code || "") === "中高") reasons.push("熟悉度尚可");

  const seeker = String(song.seeker_friendly_code || "").toLowerCase();
  if ((flags.gospel || flags.seekers) && seeker === "yes") reasons.push("對慕道友較友善");

  const matched = tags.filter((tag) => theme.includes(tag));
  if (matched.length) reasons.push(`與本週方向中的${matched.join("、")}相近`);
  return reasons.slice(0, 3).join("；");
}

function buildRiskNotes(brief, chosen, response, flags) {
  const risks = [];
  if (flags.guestSpeaker && !String(brief.response_song_given_by_pastor || "").trim()) {
    risks.push("外來講員主日建議預備一首備用回應詩歌，以免信息方向與預期不同。");
  }
  if (flags.german || normalizeBool(brief.english_lyrics_needed)) {
    risks.push("若有德國來賓，建議至少為第一首與回應詩歌準備英文歌詞或簡短英文提示。");
  }
  const mediumCount = chosen.filter(([, song]) => {
    const familiarity = String(song.familiarity_code || "").toLowerCase();
    return familiarity === "medium" || String(song.familiarity_code || "") === "中高";
  }).length;
  if (mediumCount >= 3) {
    risks.push("本套歌單以中熟悉度歌曲為主，練習時要確認會眾能否穩定跟唱。");
  }
  if (response && !String(response.song_name_zh || "").trim()) {
    risks.push("目前尚未選出合適回應詩歌，需人工補上。");
  }
  return risks;
}

function renderMarkdown(brief, chosen, response, tags, flags) {
  const serviceType = brief.service_type || "未填";
  const sermonTitle = brief.sermon_title || "未填";
  const mainDirection = [brief.devotion_theme, brief.prayer_insight, brief.church_condition].filter(Boolean).join("；") || "未填";
  const constraints = [];
  if (flags.gospel || flags.seekers) constraints.push("需顧到慕道友");
  if (flags.guestSpeaker) constraints.push("外來講員");
  if (flags.german || normalizeBool(brief.english_lyrics_needed)) constraints.push("需考慮英文歌詞");
  const constraintsText = constraints.length ? constraints.join("、") : "無特別限制";

  const lines = [];
  lines.push("# 師母審核摘要");
  lines.push("");
  lines.push(`- 聚會：${brief.service_name || brief.service_date || "本次聚會"}`);
  lines.push(`- 聚會類型：${serviceType}`);
  lines.push(`- 主要服事方向：${mainDirection}`);
  lines.push(`- 特別限制：${constraintsText}`);
  lines.push("");
  lines.push("- 建議歌單：");
  const slotNames = { song_1: "第一首", song_2: "第二首", song_3: "第三首" };
  chosen.forEach(([position, song]) => {
    lines.push(`  - ${slotNames[position]}：${song.song_name_zh}。${reasonForSong(song, position, tags, flags)}`);
  });
  if (response) lines.push(`  - 回應詩歌：${response.song_name_zh}。${reasonForSong(response, "response_song", tags, flags)}`);
  else lines.push("  - 回應詩歌：尚未決定");
  lines.push("");
  lines.push("- 這樣安排的原因：");
  lines.push(`  - 這次以「${sermonTitle}」和本週靈修、禱告方向為主，優先抓住${tags.join("、")}等主題。`);
  lines.push("  - 開場優先考慮聚集性與熟悉度，中段進入敬拜，後段為信息預備或回應留空間。");
  lines.push("  - 若回應詩歌尚未由講員指定，先保留一首可彈性承接信息的選項。");
  lines.push("");
  lines.push("- 需要留意的點：");
  const risks = buildRiskNotes(brief, chosen, response, flags);
  if (risks.length) risks.forEach((risk) => lines.push(`  - ${risk}`));
  else lines.push("  - 目前沒有明顯高風險項目。");
  lines.push("");
  lines.push("- 語言與投影片需求：");
  if (flags.german || normalizeBool(brief.english_lyrics_needed)) {
    lines.push("  - 建議至少準備部分英文歌詞與簡短英文口頭帶領。");
  } else {
    lines.push("  - 目前可先以中文投影片為主。");
  }
  lines.push("");
  lines.push("- 想請師母確認：");
  lines.push("  - 可直接通過");
  lines.push("  - 可通過，但需調整");
  lines.push("  - 請協助更換部分歌曲");
  return lines.join("\n");
}

function markdownToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let inUl = false;
  let inLi = false;
  let inSubUl = false;

  function closeAllLists() {
    if (inSubUl) { html += "</ul>"; inSubUl = false; }
    if (inLi) { html += "</li>"; inLi = false; }
    if (inUl) { html += "</ul>"; inUl = false; }
  }

  function esc(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  lines.forEach((line) => {
    if (/^# /.test(line)) {
      closeAllLists();
      html += `<h1>${inline(line.slice(2))}</h1>`;
    } else if (/^## /.test(line)) {
      closeAllLists();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (/^  - /.test(line) || /^    - /.test(line)) {
      if (!inUl) { html += "<ul>"; inUl = true; }
      if (!inLi) { html += "<li>"; inLi = true; }
      if (!inSubUl) { html += "<ul>"; inSubUl = true; }
      html += `<li>${inline(line.replace(/^\s+- /, ""))}</li>`;
    } else if (/^- /.test(line)) {
      if (inSubUl) { html += "</ul>"; inSubUl = false; }
      if (inLi) { html += "</li>"; inLi = false; }
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${inline(line.slice(2))}`;
      inLi = true;
    } else if (line.trim() === "") {
      closeAllLists();
    } else {
      closeAllLists();
      html += `<p>${inline(line)}</p>`;
    }
  });
  closeAllLists();
  return html;
}

function localTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fillForm(data) {
  Object.entries(data).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (!el) return;
    if (el.type === "checkbox") {
      el.checked = Boolean(value);
    } else if (key === "recent_songs" && Array.isArray(value)) {
      el.value = value.join("\n");
    } else {
      el.value = value ?? "";
    }
  });
  const dateInput = document.getElementById("service_date");
  if (!dateInput.value) dateInput.value = localTodayISO();
}

function formToPayload() {
  const payload = {};
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) {
    payload[key] = typeof value === "string" ? value.trim() : value;
  }
  payload.seekers_expected = document.getElementById("seekers_expected").checked;
  payload.german_attendees_expected = document.getElementById("german_attendees_expected").checked;
  payload.english_lyrics_needed = document.getElementById("english_lyrics_needed").checked;
  payload.recent_songs = splitRecentSongs(payload.recent_songs || "");

  ["total_worship_time_minutes", "allow_new_song_count"].forEach((key) => {
    if (payload[key] === "") delete payload[key];
    else payload[key] = Number(payload[key]);
  });
  return payload;
}

function showOutput(markdown) {
  latestMarkdown = markdown;
  outputRendered.innerHTML = markdownToHtml(markdown);
  outputEmpty.style.display = "none";
  outputRendered.style.display = "block";
  copyMdBtn.disabled = false;
  downloadMdBtn.disabled = false;
}

async function loadStaticData() {
  const [songsResp, templateResp] = await Promise.all([
    fetch("./songs_db_agent_v1.json"),
    fetch("./weekly_runtime_input_template.json"),
  ]);
  if (!songsResp.ok) throw new Error("無法載入歌庫 JSON");
  if (!templateResp.ok) throw new Error("無法載入範例模板");
  songsDb = await songsResp.json();
  templateData = await templateResp.json();
  fillForm({ ...templateData, service_date: localTodayISO() });
  setDataStatus(`歌庫已載入，共 ${songsDb.length} 首`, "good");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!songsDb.length) {
    setStatus("歌庫尚未載入完成。", "err");
    return;
  }
  generateBtn.disabled = true;
  generateBtn.classList.add("loading");
  generateBtn.textContent = "生成中...";
  setStatus("正在生成摘要…");
  try {
    const brief = formToPayload();
    const { chosen, response, tags, flags } = buildSet(brief, songsDb);
    const markdown = renderMarkdown(brief, chosen, response, tags, flags);
    showOutput(markdown);
    setStatus("摘要已生成。", "good");
  } catch (error) {
    setStatus(`生成失敗：${error.message}`, "err");
  } finally {
    generateBtn.disabled = false;
    generateBtn.classList.remove("loading");
    generateBtn.textContent = "生成審核摘要";
  }
});

loadTemplateBtn.addEventListener("click", () => {
  fillForm({ ...templateData, service_date: localTodayISO() });
  setStatus("已載入範例資料。", "good");
});

downloadJsonBtn.addEventListener("click", () => {
  downloadText("service_brief.json", JSON.stringify(formToPayload(), null, 2));
  setStatus("已下載 JSON。", "good");
});

copyMdBtn.addEventListener("click", async () => {
  if (!latestMarkdown) return;
  try {
    await navigator.clipboard.writeText(latestMarkdown);
    copyMdBtn.classList.add("success");
    copyMdBtn.textContent = "已複製";
    setTimeout(() => {
      copyMdBtn.classList.remove("success");
      copyMdBtn.textContent = "複製文字";
    }, 1800);
  } catch {
    setStatus("複製失敗，請改用下載 .md。", "err");
  }
});

downloadMdBtn.addEventListener("click", () => {
  if (!latestMarkdown) return;
  downloadText("review_summary.md", latestMarkdown);
  setStatus("已下載摘要。", "good");
});

document.getElementById("service_date").value = localTodayISO();

loadStaticData().catch((error) => {
  setDataStatus("歌庫載入失敗");
  setStatus(`初始化失敗：${error.message}`, "err");
});
