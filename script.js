const body = document.body;
const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const revealItems = [...document.querySelectorAll(".reveal")];
const sections = [...document.querySelectorAll("main section[id]")];
const canvas = document.querySelector(".hero-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 28);
}

function closeNav() {
  body.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  const isOpen = body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    closeNav();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNav();
  }
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16, rootMargin: "0px 0px -40px 0px" }
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  revealObserver.observe(item);
});

const activeSectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.getAttribute("id");
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
      });
    });
  },
  { threshold: 0.42 }
);

sections.forEach((section) => activeSectionObserver.observe(section));

const downloadLink = document.querySelector(".download-link");
downloadLink.addEventListener("click", () => {
  downloadLink.classList.add("is-downloading");
  window.setTimeout(() => downloadLink.classList.remove("is-downloading"), 1200);
});

let particles = [];
let width = 0;
let height = 0;
let animationFrame = null;

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.offsetWidth;
  height = canvas.offsetHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.max(34, Math.min(76, Math.floor(width / 18)));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.32,
    vy: (Math.random() - 0.5) * 0.32,
    r: Math.random() * 1.6 + 0.8,
  }));
}

function drawParticles() {
  ctx.clearRect(0, 0, width, height);

  particles.forEach((point, index) => {
    point.x += point.vx;
    point.y += point.vy;

    if (point.x < 0 || point.x > width) point.vx *= -1;
    if (point.y < 0 || point.y > height) point.vy *= -1;

    ctx.beginPath();
    ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(101, 230, 244, 0.55)";
    ctx.fill();

    for (let i = index + 1; i < particles.length; i += 1) {
      const other = particles[i];
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 118) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(other.x, other.y);
        ctx.strokeStyle = `rgba(101, 230, 244, ${0.18 - distance / 700})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  animationFrame = window.requestAnimationFrame(drawParticles);
}

window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("resize", resizeCanvas);

updateHeader();

if (!prefersReducedMotion) {
  resizeCanvas();
  drawParticles();
} else {
  canvas.remove();
}

window.addEventListener("beforeunload", () => {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }
});

// Chat workspace: provider-agnostic, local-first, and safe to deploy as static files.
const chatApp = document.querySelector("[data-chat-app]");
const chatStorageKey = "harsh-portfolio-chat-history";
const chatSettingsKey = "harsh-portfolio-chat-settings";
const sessionKey = "harsh-portfolio-chat-api-key";
const defaultSettings = {
  provider: "demo",
  model: "gpt-4o-mini",
  proxyUrl: "",
  systemPrompt: "You are a concise, helpful assistant. Preserve context, be honest about uncertainty, and use markdown when it improves clarity.",
  streaming: true,
  saveKey: false,
};

if (chatApp) {
  const messagesElement = chatApp.querySelector("[data-messages]");
  const form = chatApp.querySelector("[data-chat-form]");
  const input = chatApp.querySelector("[data-message-input]");
  const list = chatApp.querySelector("[data-conversation-list]");
  const status = chatApp.querySelector("[data-connection-status]");
  const activeTitle = chatApp.querySelector("[data-active-chat-title]");
  const stopButton = chatApp.querySelector("[data-stop-chat]");
  const settingsDialog = document.querySelector("[data-settings-dialog]");
  const settingsForm = document.querySelector("[data-settings-form]");
  let settings = loadSettings();
  let conversations = loadConversations();
  let activeConversationId = conversations[0]?.id || createConversation();
  let abortController = null;
  let isGenerating = false;
  let transientApiKey = "";

  function loadSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(chatSettingsKey) || "{}") };
    } catch {
      return { ...defaultSettings };
    }
  }

  function loadConversations() {
    try {
      const saved = JSON.parse(localStorage.getItem(chatStorageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && item.id && Array.isArray(item.messages)) : [];
    } catch {
      return [];
    }
  }

  function persistConversations() {
    localStorage.setItem(chatStorageKey, JSON.stringify(conversations.slice(0, 24)));
  }

  function createConversation() {
    const conversation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: "New conversation",
      updatedAt: Date.now(),
      messages: [],
    };
    conversations.unshift(conversation);
    persistConversations();
    return conversation.id;
  }

  function getActiveConversation() {
    return conversations.find((conversation) => conversation.id === activeConversationId);
  }

  function currentApiKey() {
    return transientApiKey || (settings.saveKey ? sessionStorage.getItem(sessionKey) || "" : "");
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character]));
  }

  function renderMarkdown(value) {
    const escaped = escapeHtml(value);
    const blocks = [];
    const withPlaceholders = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, language, code) => {
      blocks.push(`<pre><code>${code.trim()}</code></pre>`);
      return `@@CODE${blocks.length - 1}@@`;
    });
    return withPlaceholders
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h3>$1</h3>")
      .replace(/^# (.*)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.startsWith("<h") || paragraph.startsWith("<pre") ? paragraph : `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
      .join("")
      .replace(/@@CODE(\d+)@@/g, (_, index) => blocks[index]);
  }

  function renderConversations(filter = "") {
    const query = filter.trim().toLowerCase();
    list.innerHTML = "";
    conversations
      .filter((conversation) => !query || conversation.title.toLowerCase().includes(query) || conversation.messages.some((message) => message.content.toLowerCase().includes(query)))
      .forEach((conversation) => {
        const button = document.createElement("button");
        button.className = `conversation-item ${conversation.id === activeConversationId ? "is-active" : ""}`;
        button.type = "button";
        button.innerHTML = `<strong>${escapeHtml(conversation.title)}</strong><span>${conversation.messages.length ? `${conversation.messages.length} messages` : "Empty chat"}</span>`;
        button.addEventListener("click", () => {
          activeConversationId = conversation.id;
          renderChat();
          renderConversations(filter);
        });
        list.append(button);
      });
  }

  function renderChat() {
    const conversation = getActiveConversation();
    if (!conversation) return;
    activeTitle.textContent = conversation.title;
    messagesElement.innerHTML = "";
    if (!conversation.messages.length) {
      addMessageElement("assistant", "Hi, I’m Harsh’s AI workspace. Ask me about a project, explore an idea, or paste code for a thoughtful review.");
    } else {
      conversation.messages.forEach((message) => addMessageElement(message.role, message.content, false));
    }
    messagesElement.scrollTop = messagesElement.scrollHeight;
    renderConversations(document.querySelector("[data-search-chats]")?.value || "");
  }

  function addMessageElement(role, content, shouldScroll = true) {
    const message = document.createElement("article");
    message.className = `message ${role}`;
    message.dataset.role = role;
    message.innerHTML = `<span class="message-avatar" aria-hidden="true">${role === "user" ? "You" : "✦"}</span><div class="message-body">${renderMarkdown(content)}${role === "assistant" ? '<div class="message-actions"><button type="button" data-copy-message>Copy</button><button type="button" data-regenerate>Regenerate</button></div>' : ""}</div>`;
    message.querySelector("[data-copy-message]")?.addEventListener("click", () => navigator.clipboard?.writeText(content));
    message.querySelector("[data-regenerate]")?.addEventListener("click", () => regenerateLastResponse());
    messagesElement.append(message);
    if (shouldScroll) messagesElement.scrollTop = messagesElement.scrollHeight;
    return message;
  }

  function setGenerating(value) {
    isGenerating = value;
    input.disabled = value;
    chatApp.querySelector(".send-button").disabled = value;
    stopButton.hidden = !value;
    status.textContent = value ? "Generating response…" : `${settings.provider === "demo" ? "Demo mode" : settings.provider} · ready to help`;
  }

  function addTypingElement() {
    const element = addMessageElement("assistant", "", true);
    element.querySelector(".message-body").innerHTML = '<div class="typing-indicator" aria-label="Assistant is typing"><i></i><i></i><i></i></div>';
    return element;
  }

  function compactMessages(messages) {
    if (messages.length <= 16) return messages;
    const older = messages.slice(0, -12).filter((message) => message.role !== "system").map((message) => `${message.role}: ${message.content.slice(0, 180)}`).join(" | ");
    return [{ role: "system", content: `Earlier context summary: ${older.slice(0, 1500)}` }, ...messages.slice(-12)];
  }

  function demoResponse(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes("code") || lower.includes("review")) return "Paste the snippet you want reviewed and I’ll look at correctness, readability, edge cases, and a practical next step. I can also return a focused diff-style suggestion.";
    if (lower.includes("project") || lower.includes("build")) return "A strong next step is to define the smallest useful version first: the user action, the data it needs, and one measurable success signal. Then we can choose the simplest architecture that keeps the path open for future providers.";
    return "I’m running in local demo mode, so no request leaves this browser. Configure a provider or a server-side proxy in Settings to get live model responses. What would you like to explore?";
  }

  async function streamFetch(url, options, onChunk) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    if (!response.body) return response.text();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(chunk, fullText);
    }
    return fullText;
  }

  async function requestProvider(messages, onChunk) {
    if (settings.provider === "demo") {
      const text = demoResponse(messages.at(-1).content);
      for (const word of text.split(" ")) {
        await new Promise((resolve) => window.setTimeout(resolve, 18));
        onChunk(`${word} `, undefined, true);
      }
      return text;
    }
    const key = currentApiKey();
    const headers = { "Content-Type": "application/json" };
    if (key && !settings.proxyUrl) {
      if (settings.provider === "anthropic") {
        headers["x-api-key"] = key;
        headers["anthropic-version"] = "2023-06-01";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      } else if (settings.provider !== "gemini") {
        headers.Authorization = `Bearer ${key}`;
      }
    }
    const url = settings.proxyUrl || (settings.provider === "anthropic" ? "https://api.anthropic.com/v1/messages" : settings.provider === "gemini" ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:streamGenerateContent?alt=sse` : "https://api.openai.com/v1/chat/completions");
    const conversationMessages = messages.filter((message) => message.role !== "system");
    const payload = settings.provider === "anthropic"
      ? { model: settings.model, max_tokens: 1200, stream: Boolean(settings.streaming), system: settings.systemPrompt, messages: conversationMessages.map(({ role, content }) => ({ role: role === "assistant" ? "assistant" : "user", content })) }
      : settings.provider === "gemini"
        ? { contents: conversationMessages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })) }
        : { model: settings.model, stream: Boolean(settings.streaming), messages: [{ role: "system", content: settings.systemPrompt }, ...conversationMessages] };
    if (settings.provider === "gemini" && key) headers["x-goog-api-key"] = key;
    const responseText = await streamFetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: abortController.signal }, (chunk, fullText) => {
      if (!settings.streaming) return;
      const candidates = fullText.split("\n").filter(Boolean);
      const latest = candidates.at(-1)?.replace(/^data:\s*/, "");
      try {
        const parsed = JSON.parse(latest);
        const text = parsed.choices?.[0]?.delta?.content || parsed.delta?.text || parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) onChunk(text, undefined, true);
      } catch {
        // Incomplete SSE frames are completed by the next chunk.
      }
    });
    if (settings.provider === "openai" && !settings.streaming) return JSON.parse(responseText).choices[0].message.content;
    return settings.streaming ? "" : responseText;
  }

  async function sendMessage(content) {
    if (!content || isGenerating) return;
    const conversation = getActiveConversation();
    conversation.messages.push({ role: "user", content });
    conversation.title = conversation.messages.filter((message) => message.role === "user")[0]?.content.slice(0, 36) || "New conversation";
    conversation.updatedAt = Date.now();
    persistConversations();
    addMessageElement("user", content);
    input.value = "";
    input.style.height = "auto";
    const typing = addTypingElement();
    setGenerating(true);
    abortController = new AbortController();
    let answer = "";
    try {
      const messages = compactMessages([{ role: "system", content: settings.systemPrompt }, ...conversation.messages]);
      answer = await requestProvider(messages, (chunk, _full, streamed) => {
        if (!streamed) return;
        answer += chunk;
        typing.querySelector(".message-body").innerHTML = `${renderMarkdown(answer)}<div class="message-actions"><button type="button" data-copy-message>Copy</button></div>`;
        typing.querySelector("[data-copy-message]")?.addEventListener("click", () => navigator.clipboard?.writeText(answer));
        messagesElement.scrollTop = messagesElement.scrollHeight;
      });
      if (!answer) answer = "The provider returned an empty response. Check the model and connection settings.";
      typing.remove();
      addMessageElement("assistant", answer);
      conversation.messages.push({ role: "assistant", content: answer });
      conversation.updatedAt = Date.now();
      persistConversations();
      renderConversations();
    } catch (error) {
      typing.remove();
      if (error.name !== "AbortError") addMessageElement("assistant", `I couldn’t complete that request. ${error.message} Check Settings, or switch to Demo mode to continue locally.`);
    } finally {
      abortController = null;
      setGenerating(false);
    }
  }

  function regenerateLastResponse() {
    const conversation = getActiveConversation();
    const lastUser = [...conversation.messages].reverse().find((message) => message.role === "user");
    if (!lastUser || isGenerating) return;
    conversation.messages = conversation.messages.slice(0, conversation.messages.lastIndexOf(lastUser));
    persistConversations();
    renderChat();
    sendMessage(lastUser.content);
  }

  function populateSettings() {
    settingsForm.querySelector("[data-provider]").value = settings.provider;
    settingsForm.querySelector("[data-model]").value = settings.model;
    settingsForm.querySelector("[data-proxy-url]").value = settings.proxyUrl;
    settingsForm.querySelector("[data-system-prompt]").value = settings.systemPrompt;
    settingsForm.querySelector("[data-streaming]").checked = settings.streaming;
    settingsForm.querySelector("[data-save-key]").checked = settings.saveKey;
    settingsForm.querySelector("[data-api-key]").value = currentApiKey();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value.trim());
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  chatApp.querySelector("[data-new-chat]").addEventListener("click", () => {
    activeConversationId = createConversation();
    renderChat();
    input.focus();
  });
  chatApp.querySelector("[data-search-chats]").addEventListener("input", (event) => renderConversations(event.target.value));
  chatApp.querySelector("[data-clear-chat]").addEventListener("click", () => {
    const conversation = getActiveConversation();
    conversation.messages = [];
    conversation.title = "New conversation";
    persistConversations();
    renderChat();
  });
  stopButton.addEventListener("click", () => abortController?.abort());
  chatApp.querySelector("[data-close-chat]").addEventListener("click", () => {
    document.querySelector("[data-chat-dialog]").close();
  });
  document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", () => {
    populateSettings();
    settingsDialog.showModal();
  }));
  document.querySelector("[data-save-settings]").addEventListener("click", () => {
    const apiKey = settingsForm.querySelector("[data-api-key]").value.trim();
    settings = {
      provider: settingsForm.querySelector("[data-provider]").value,
      model: settingsForm.querySelector("[data-model]").value.trim() || defaultSettings.model,
      proxyUrl: settingsForm.querySelector("[data-proxy-url]").value.trim(),
      systemPrompt: settingsForm.querySelector("[data-system-prompt]").value.trim() || defaultSettings.systemPrompt,
      streaming: settingsForm.querySelector("[data-streaming]").checked,
      saveKey: settingsForm.querySelector("[data-save-key]").checked,
    };
    transientApiKey = apiKey;
    if (settings.saveKey && apiKey) sessionStorage.setItem(sessionKey, apiKey);
    else sessionStorage.removeItem(sessionKey);
    localStorage.setItem(chatSettingsKey, JSON.stringify(settings));
    status.textContent = `${settings.provider === "demo" ? "Demo mode" : settings.provider} · ready to help`;
    settingsDialog.close();
  });
  document.querySelectorAll("[data-suggestions] button").forEach((button) => button.addEventListener("click", () => {
    input.value = button.textContent;
    input.focus();
  }));
  document.querySelectorAll("[data-open-chat]").forEach((button) => button.addEventListener("click", () => {
    const chatDialog = document.querySelector("[data-chat-dialog]");
    chatDialog.showModal();
    window.setTimeout(() => input.focus(), 50);
  }));

  renderChat();
  renderConversations();
}
