const supabaseClient = (() => {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey || cfg.url.includes("ВАШ-ПРОЕКТ")) {
    return null;
  }
  return window.supabase.createClient(cfg.url, cfg.publishableKey);
})();

const form = document.getElementById("commentForm");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const list = document.getElementById("commentsList");
const count = document.getElementById("commentCount");
const charCount = document.getElementById("charCount");

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
    <article class="comment">
      <div class="comment-top">
        <span class="comment-name">${escapeHtml(c.name)}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <div class="comment-text">${escapeHtml(c.message)}</div>
    </article>
  `).join("");
}

async function loadComments(){
  if(!supabaseClient){
    list.innerHTML = `
      <div class="empty">
        База данных пока не подключена.<br>
        Откройте <strong>config.js</strong> и укажите данные проекта Supabase.
      </div>`;
    count.textContent = "База не подключена";
    return;
  }

  const { data, error } = await supabaseClient
    .from("comments")
    .select("id,name,message,created_at")
    .order("created_at", { ascending: false });

  if(error){
    console.error(error);
    list.innerHTML = `
      <div class="empty">
        Не удалось загрузить комментарии.<br>
        Проверьте SQL-политику и настройки Supabase.
      </div>`;
    return;
  }

  renderComments(data || []);
}

messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length} / 500`;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if(!name || !message) return;

  if(!supabaseClient){
    alert("Сначала подключите Supabase в config.js.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Публикуем...";

  const { error } = await supabaseClient
    .from("comments")
    .insert({ name, message });

  submitButton.disabled = false;
  submitButton.textContent = "Опубликовать комментарий";

  if(error){
    console.error(error);
    alert("Не удалось опубликовать комментарий. Проверьте настройки базы.");
    return;
  }

  form.reset();
  charCount.textContent = "0 / 500";
  await loadComments();
});

document.getElementById("year").textContent = new Date().getFullYear();
loadComments();


// Активный пункт меню меняется по мере прокрутки страницы.

// Активный пункт меню всегда подсвечивается одинаково.
// Главная тоже получает жирный белый текст и нижнее подчёркивание.
const navLinks = [...document.querySelectorAll('nav a[href^="#"]')];
const sections = navLinks
  .map(link => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActive(id) {
  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
}

// Отслеживаем все разделы, включая Главную.
const sectionObserver = new IntersectionObserver(entries => {
  const visible = entries
    .filter(entry => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

  if (visible) setActive(visible.target.id);
}, {
  rootMargin: "-12% 0px -70% 0px",
  threshold: [0, 0.15, 0.35, 0.6]
});

sections.forEach(section => sectionObserver.observe(section));

// При клике активное состояние ставится сразу,
// поэтому Главная визуально ведёт себя так же, как остальные кнопки.
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
      const targetTop =
        window.scrollY + target.getBoundingClientRect().top - headerHeight - 24;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth"
      });
    }

    history.pushState(null, "", targetId);
  });
});

// Если страница открыта с #home — Главная сразу активна.
if (location.hash && document.querySelector(location.hash)) {
  setActive(location.hash.slice(1));
} else {
  setActive("home");
}
