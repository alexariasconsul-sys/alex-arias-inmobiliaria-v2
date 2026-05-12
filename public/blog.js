/* ════════════════════════════════════════════════════════════
   BLOG.JS  —  Alex Arias · Consultor Inmobiliario
   Maneja listado de posts (/blog) y vista individual (/post.html)
═════════════════════════════════════════════════════════════ */

const IS_POST_PAGE = document.body.classList.contains('post-body') || document.getElementById('postArticle') !== null;

// ─── HELPERS ──────────────────────────────────────────────────
function fmt(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtShort(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function slugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || '';
}

function coverUrl(cover) {
  if (!cover) return '';
  if (cover.startsWith('http')) return cover;
  return '/' + cover;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

// ─── FOOTER YEAR ──────────────────────────────────────────────
document.querySelectorAll('#footerYear').forEach(el => el.textContent = new Date().getFullYear());

/* ════════════════════════════════════════════════════════════
   PÁGINA: LISTADO  (blog.html)
═════════════════════════════════════════════════════════════ */
if (document.getElementById('blogGrid')) {
  const grid      = document.getElementById('blogGrid');
  const skeleton  = document.getElementById('blogSkeleton');
  const empty     = document.getElementById('blogEmpty');
  const loadMore  = document.getElementById('blogLoadMore');
  const btnMore   = document.getElementById('btnLoadMore');
  const catsWrap  = document.getElementById('blogCats');

  let currentCat = '';
  let offset = 0;
  const LIMIT = 9;
  let totalPosts = 0;
  let loading = false;

  // Cargar categorías
  async function loadCats() {
    try {
      const res = await fetch('/api/blog/categories');
      const cats = await res.json();
      cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'blog-cat';
        btn.dataset.cat = cat;
        btn.textContent = cat;
        btn.addEventListener('click', () => selectCat(cat));
        catsWrap.appendChild(btn);
      });
    } catch (_) {}
  }

  function selectCat(cat) {
    currentCat = cat;
    catsWrap.querySelectorAll('.blog-cat').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    offset = 0;
    grid.innerHTML = '';
    loadPosts(true);
  }

  catsWrap.querySelector('[data-cat=""]').addEventListener('click', () => selectCat(''));

  // Renderizar tarjeta
  function renderCard(post, featured = false) {
    const hasCover = !!post.cover;
    const card = document.createElement('article');
    card.className = 'blog-card' + (featured ? ' blog-card--featured' : '');
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/BlogPosting');
    card.innerHTML = `
      <a href="/post.html?slug=${encodeURIComponent(post.slug)}" class="blog-card-link" itemprop="url" aria-label="${post.title}">
        <div class="blog-card-media ${!hasCover ? 'blog-card-media--placeholder' : ''}">
          ${hasCover
            ? `<img src="${coverUrl(post.cover)}" alt="${post.title}" class="blog-card-img" loading="lazy" itemprop="image" />`
            : `<div class="blog-card-no-img">
                <svg viewBox="0 0 24 24" fill="none" width="32" height="32"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5"/></svg>
               </div>`
          }
          ${post.category ? `<span class="blog-card-cat">${post.category}</span>` : ''}
        </div>
        <div class="blog-card-body">
          <h2 class="blog-card-title" itemprop="headline">${post.title}</h2>
          ${post.excerpt ? `<p class="blog-card-excerpt" itemprop="description">${truncate(post.excerpt, 120)}</p>` : ''}
          <div class="blog-card-foot">
            <time class="blog-card-date" datetime="${post.published_at || post.created_at}" itemprop="datePublished">${fmtShort(post.published_at || post.created_at)}</time>
            ${post.readTime ? `<span class="blog-card-read">${post.readTime} min</span>` : ''}
          </div>
        </div>
      </a>
    `;
    return card;
  }

  // Cargar posts
  async function loadPosts(reset = false) {
    if (loading) return;
    loading = true;
    if (reset) {
      skeleton.style.display = 'grid';
      empty.style.display = 'none';
      loadMore.style.display = 'none';
    }

    try {
      const params = new URLSearchParams({ limit: LIMIT, offset });
      if (currentCat) params.set('category', currentCat);
      const res = await fetch(`/api/blog?${params}`);
      const { posts, total } = await res.json();
      totalPosts = total;

      skeleton.style.display = 'none';

      if (posts.length === 0 && offset === 0) {
        empty.style.display = 'flex';
      } else {
        posts.forEach((p, i) => {
          grid.appendChild(renderCard(p, offset === 0 && i === 0));
        });
        offset += posts.length;
        loadMore.style.display = offset < totalPosts ? 'flex' : 'none';
      }
    } catch (err) {
      skeleton.style.display = 'none';
      console.error(err);
    }
    loading = false;
  }

  btnMore?.addEventListener('click', () => loadPosts());

  loadCats();
  loadPosts(true);

  // Socket.io — nuevos posts en tiempo real
  try {
    const socket = io();
    socket.on('blog-new',     () => { offset = 0; grid.innerHTML = ''; loadPosts(true); });
    socket.on('blog-updated', () => { offset = 0; grid.innerHTML = ''; loadPosts(true); });
    socket.on('blog-deleted', () => { offset = 0; grid.innerHTML = ''; loadPosts(true); });
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════════
   PÁGINA: POST INDIVIDUAL  (post.html)
═════════════════════════════════════════════════════════════ */
if (document.getElementById('postArticle')) {
  const slug = slugFromUrl();
  const loadingEl  = document.getElementById('postLoading');
  const wrapperEl  = document.getElementById('postWrapper');
  const notFound   = document.getElementById('post404');

  if (!slug) {
    loadingEl.style.display = 'none';
    notFound.style.display  = 'flex';
  } else {
    loadPost(slug);
  }

  async function loadPost(slug) {
    try {
      const res = await fetch(`/api/blog/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('not found');
      const post = await res.json();
      renderPost(post);

      // Registrar vista
      fetch(`/api/blog/${encodeURIComponent(slug)}/view`, { method: 'POST' })
        .then(r => r.json()).then(({ views }) => {
          const el = document.getElementById('postViews');
          if (el) el.textContent = `${views} vista${views !== 1 ? 's' : ''}`;
        }).catch(() => {});

      // Cargar relacionados
      loadRelated(post.category, slug);
    } catch (_) {
      loadingEl.style.display = 'none';
      notFound.style.display  = 'flex';
    }
  }

  function renderPost(post) {
    // ── Meta tags dinámicos ──
    const title = post.seo?.metaTitle || post.title;
    const desc  = post.seo?.metaDescription || post.excerpt || '';
    const imgUrl = post.cover ? (location.origin + '/' + post.cover) : '';
    const url   = `${location.origin}/post.html?slug=${post.slug}`;

    document.getElementById('pageTitle').textContent = `${title} · Alex Arias Blog`;
    document.getElementById('metaDesc').setAttribute('content', desc);
    document.getElementById('canonicalUrl').setAttribute('href', url);
    document.getElementById('ogTitle').setAttribute('content', title);
    document.getElementById('ogDesc').setAttribute('content', desc);
    document.getElementById('ogImage').setAttribute('content', imgUrl);
    document.getElementById('ogUrl').setAttribute('content', url);
    document.getElementById('twTitle').setAttribute('content', title);
    document.getElementById('twDesc').setAttribute('content', desc);
    document.getElementById('twImage').setAttribute('content', imgUrl);

    // ── JSON-LD Article ──
    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.excerpt || '',
      "author": { "@type": "Person", "name": "Alexander Arias", "jobTitle": "Consultor Inmobiliario" },
      "datePublished": post.published_at || post.created_at,
      "dateModified": post.updated_at || post.created_at,
      "image": imgUrl || undefined,
      "url": url,
      "publisher": {
        "@type": "Person",
        "name": "Alexander Arias"
      }
    };
    document.getElementById('articleSchema').textContent = JSON.stringify(schema);

    // ── DOM ──
    document.getElementById('breadCat').textContent = post.category || 'Artículo';

    // Cover
    if (post.cover) {
      const coverWrap = document.getElementById('postCoverWrap');
      const coverImg  = document.getElementById('postCoverImg');
      coverImg.src = coverUrl(post.cover);
      coverImg.alt = post.title;
      coverWrap.style.display = 'block';
    }

    // Categoría
    const catEl = document.getElementById('postCategory');
    if (post.category) { catEl.textContent = post.category; catEl.style.display = 'inline-block'; }

    // Título y excerpt
    document.getElementById('postTitle').textContent = post.title;
    const excerptEl = document.getElementById('postExcerpt');
    if (post.excerpt) { excerptEl.textContent = post.excerpt; }
    else excerptEl.style.display = 'none';

    // Fecha y lectura
    const dateEl = document.getElementById('postDate');
    dateEl.textContent = fmt(post.published_at || post.created_at);
    dateEl.setAttribute('datetime', post.published_at || post.created_at);
    if (post.readTime) document.getElementById('postReadTime').textContent = `${post.readTime} min de lectura`;
    document.getElementById('postViews').textContent = `${post.views || 0} vistas`;

    // Contenido
    document.getElementById('postContent').innerHTML = post.content || '<p>Sin contenido.</p>';

    // Tags
    if (post.tags?.length) {
      const tagsEl = document.getElementById('postTags');
      post.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'post-tag';
        span.textContent = t;
        tagsEl.appendChild(span);
      });
      document.getElementById('postTagsFooter').style.display = 'block';
    }

    // Likes
    document.getElementById('postLikeCount').textContent = post.likes || 0;
    const likedKey = `blog-like-${post.slug}`;
    let liked = localStorage.getItem(likedKey) === '1';
    const likeBtn = document.getElementById('postLikeBtn');
    const heartIcon = document.getElementById('heartIcon');
    if (liked) { likeBtn.classList.add('liked'); heartIcon.setAttribute('fill', 'var(--brand)'); }

    likeBtn.addEventListener('click', async () => {
      liked = !liked;
      localStorage.setItem(likedKey, liked ? '1' : '0');
      likeBtn.classList.toggle('liked', liked);
      const fill = liked ? 'var(--brand)' : 'none';
      heartIcon.setAttribute('fill', fill);
      try {
        const r = await fetch(`/api/blog/${post.slug}/like`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: liked ? 'add' : 'remove' })
        });
        const { likes } = await r.json();
        document.getElementById('postLikeCount').textContent = likes;
      } catch (_) {}
    });

    // Compartir
    document.getElementById('postShareBtn').addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ title: post.title, text: post.excerpt, url }); return; } catch (_) {}
      }
      navigator.clipboard.writeText(url).then(() => alert('Enlace copiado')).catch(() => {});
    });

    // Mostrar
    loadingEl.style.display = 'none';
    wrapperEl.style.display = 'block';
  }

  async function loadRelated(category, currentSlug) {
    try {
      // 1) Buscar en la misma categoría
      const params = new URLSearchParams({ limit: 10 });
      if (category) params.set('category', category);
      const res  = await fetch(`/api/blog?${params}`);
      const { posts } = await res.json();
      let related = posts.filter(p => p.slug !== currentSlug).slice(0, 3);

      // 2) Si no hay suficientes, completar con cualquier otro post
      if (related.length < 3) {
        const res2  = await fetch('/api/blog?limit=10');
        const { posts: all } = await res2.json();
        const slugsYa = new Set([currentSlug, ...related.map(p => p.slug)]);
        const extras  = all.filter(p => !slugsYa.has(p.slug));
        related = [...related, ...extras].slice(0, 3);
      }

      const list = document.getElementById('relatedList');
      if (!related.length) { list.innerHTML = '<p class="post-related-empty">No hay artículos relacionados aún.</p>'; return; }
      related.forEach(p => {
        const a = document.createElement('a');
        a.href = `/post.html?slug=${encodeURIComponent(p.slug)}`;
        a.className = 'post-related-item';
        a.innerHTML = `
          ${p.cover ? `<img src="${coverUrl(p.cover)}" alt="${p.title}" class="post-related-thumb" loading="lazy" />` : '<div class="post-related-thumb post-related-thumb--empty"></div>'}
          <div class="post-related-info">
            <span class="post-related-cat">${p.category || ''}</span>
            <h3 class="post-related-title">${p.title}</h3>
            <span class="post-related-date">${fmtShort(p.published_at || p.created_at)}</span>
          </div>
        `;
        list.appendChild(a);
      });
    } catch (_) {}
  }
}
