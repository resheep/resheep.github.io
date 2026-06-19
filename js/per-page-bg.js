(() => {
  const bg = document.getElementById('web_bg');
  const header = document.getElementById('page-header');
  if (!bg || !header) return;

  // 读取页面 top_img 横幅
  const headerBg = header.style.backgroundImage;
  const topImg = headerBg && headerBg !== 'none'
    ? headerBg.replace(/url\(["']?|["']?\)/g, '')
    : '';

  if (!topImg) return;

  // 整页背景使用同一张图
  bg.style.background = `url(${topImg}) center/cover no-repeat fixed`;

  // 让顶部横幅透明，背景图透过来，消除割裂感
  header.style.backgroundImage = 'none';
  header.style.backgroundColor = 'transparent';
})();
