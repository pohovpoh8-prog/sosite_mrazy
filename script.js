const supabaseClient = (() => {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey || cfg.url.includes("ВАШ-ПРОЕКТ")) return null;
  return window.supabase.createClient(cfg.url, cfg.publishableKey);
})();

const form = document.getElementById("commentForm");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const list = document.getElementById("commentsList");
const count = document.getElementById("commentCount");
const charCount = document.getElementById("charCount");
const adminToggle = document.getElementById("adminToggle");
const adminForm = document.getElementById("adminForm");
const adminLogout = document.getElementById("adminLogout");
const adminStatus = document.getElementById("adminStatus");

const COMMENT_COOLDOWN_MS = 7000;
const COMMENT_COOLDOWN_KEY = "dmitry_comment_last_sent";
let adminMode = false;

function plural(n, one, few, many){
  const n10=n%10,n100=n%100;
  if(n10===1 && n100!==11) return one;
  if(n10>=2 && n10<=4 && (n100<10 || n100>=20)) return few;
  return many;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function formatDate(value){
  return new Intl.DateTimeFormat("ru-RU", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  }).format(new Date(value));
}

function renderComments(items){
  count.textContent = `${items.length} ${plural(items.length, "комментарий", "комментария", "комментариев")}`;

  if(!items.length){
    list.innerHTML = '<div class="empty">Пока комментариев нет. Будьте первым!</div>';
    return;
  }

  list.innerHTML = items.map(c => `
    <article class="comment" data-comment-id="${escapeHtml(c.id)}">
      <div class="comment-top">
        <span class="comment-name">${escapeHtml(c.name)}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <div class="comment-text">${escapeHtml(c.message)}</div>
      ${adminMode ? `<button class="delete" type="button" data-delete-id="${escapeHtml(c.id)}">Удалить</button>` : ""}
    </article>
  `).join("");
}

async function loadComments(){
  if(!supabaseClient){
    list.innerHTML = '<div class="empty">База данных пока не подключена.</div>';
    count.textContent = "База не подключена";
    return;
  }

  const { data, error } = await supabaseClient
    .from("comments")
    .select("id,name,message,created_at")
    .order("created_at", { ascending: false });

  if(error){
    console.error(error);
    list.innerHTML = '<div class="empty">Не удалось загрузить комментарии. Проверьте настройки Supabase.</div>';
    return;
  }

  renderComments(data || []);
}

function getCooldownLeft(){
  const last = Number(localStorage.getItem(COMMENT_COOLDOWN_KEY) || 0);
  return Math.max(0, COMMENT_COOLDOWN_MS - (Date.now() - last));
}

messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length} / 500`;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const message = messageInput.value.trim();
  if(!name || !message) return;

  const cooldownLeft = getCooldownLeft();
  if(cooldownLeft > 0){
    alert(`Подожди ещё ${Math.ceil(cooldownLeft / 1000)} сек. перед следующим комментарием.`);
    return;
  }

  if(!supabaseClient){
    alert("Сначала подключите Supabase в config.js.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Публикуем...";

  const { error } = await supabaseClient.from("comments").insert({ name, message });

  submitButton.disabled = false;
  submitButton.textContent = "Опубликовать комментарий";

  if(error){
    console.error(error);
    alert("Не удалось опубликовать комментарий. Проверьте настройки базы.");
    return;
  }

  localStorage.setItem(COMMENT_COOLDOWN_KEY, String(Date.now()));
  form.reset();
  charCount.textContent = "0 / 500";
  await loadComments();
});

async function refreshAdminMode(){
  if(!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){
    adminMode = false;
    adminToggle.hidden = false;
    adminForm.hidden = true;
    adminLogout.hidden = true;
    renderCurrentCommentsIfLoaded();
    return;
  }

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  adminMode = !error && !!data;
  adminToggle.hidden = adminMode;
  adminForm.hidden = true;
  adminLogout.hidden = !adminMode;
  renderCurrentCommentsIfLoaded();
}

function renderCurrentCommentsIfLoaded(){
  const cards = [...list.querySelectorAll(".comment")];
  if(!cards.length) return;
  cards.forEach(card => {
    const id = card.dataset.commentId;
    const old = card.querySelector(".delete");
    if(adminMode && !old){
      const button = document.createElement("button");
      button.className = "delete";
      button.type = "button";
      button.dataset.deleteId = id;
      button.textContent = "Удалить";
      card.appendChild(button);
    } else if(!adminMode && old){
      old.remove();
    }
  });
}

adminToggle.addEventListener("click", () => {
  adminForm.hidden = false;
  adminToggle.hidden = true;
  adminStatus.textContent = "";
});

document.getElementById("adminCancel").addEventListener("click", () => {
  adminForm.hidden = true;
  adminToggle.hidden = false;
  adminStatus.textContent = "";
});

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!supabaseClient) return;
  adminStatus.textContent = "Входим...";

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if(error){
    adminStatus.textContent = "Не удалось войти. Проверьте email и пароль.";
    return;
  }

  await refreshAdminMode();
  if(!adminMode) adminStatus.textContent = "Аккаунт вошёл, но не добавлен как администратор.";
});

adminLogout.addEventListener("click", async () => {
  if(!supabaseClient) return;
  await supabaseClient.auth.signOut();
  await refreshAdminMode();
});

list.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-delete-id]");
  if(!button || !adminMode || !supabaseClient) return;
  if(!confirm("Удалить этот комментарий?")) return;

  button.disabled = true;
  const { error } = await supabaseClient.from("comments").delete().eq("id", button.dataset.deleteId);
  if(error){
    console.error(error);
    alert("Не удалось удалить комментарий.");
    button.disabled = false;
    return;
  }
  await loadComments();
});

document.getElementById("year").textContent = new Date().getFullYear();
loadComments();
refreshAdminMode();

// Навигация: Главная → Обо мне → Услуги → Контакты → Комментарии.
const navLinks = [...document.querySelectorAll('nav a[href^="#"]')];
const sections = navLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);

function setActive(id) {
  navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${id}`));
}

const sectionObserver = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (visible) setActive(visible.target.id);
}, { rootMargin: "-12% 0px -70% 0px", threshold: [0, 0.15, 0.35, 0.6] });
sections.forEach(section => sectionObserver.observe(section));

navLinks.forEach(link => {
  link.addEventListener("click", event => {
    const targetId = link.getAttribute("href");
    const target = document.querySelector(targetId);
    if (!target) return;
    event.preventDefault();
    setActive(targetId.slice(1));
    if (targetId === "#home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const header = document.querySelector(".header");
      const headerHeight = header ? header.offsetHeight : 72;
      const targetTop = window.scrollY + target.getBoundingClientRect().top - headerHeight - 24;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }
    history.pushState(null, "", targetId);
  });
});

if (location.hash && document.querySelector(location.hash)) setActive(location.hash.slice(1));
else setActive("home");
