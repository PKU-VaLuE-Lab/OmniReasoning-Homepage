(() => {
  "use strict";

  const W = 1920;
  const H = 605;
  const LINK_SPACE = 88;
  const MAX_RENDER_PIXELS = 16777216;
  const artwork = document.querySelector(".artwork");
  const canvas = document.querySelector(".mosaic");
  const status = document.querySelector("#status");
  const ctx = canvas.getContext("2d", { alpha: false });
  const layer = document.createElement("canvas");
  const ink = layer.getContext("2d");
  if (!ctx || !ink) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    paused: reducedMotion.matches,
    travel: 0,
    x: 0, y: 0, targetX: 0, targetY: 0,
    hoverX: 0, hoverY: 0, targetHoverX: 0, targetHoverY: 0,
    zoom: 1, targetZoom: 1,
    panX: 0, panY: 0, targetPanX: 0, targetPanY: 0,
  };
  const pointers = new Map();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = (value, size) => ((value % size) + size) % size;
  let images, frame = 0, previousTime = 0, clickTimer;
  let viewWidth = W, viewHeight = H, tileScale = 1, shade, overlayBounds;
  let pixelRatioQuery;
  let lastPointer, dragged = false, downAt, pinchDistance = 0, pinchZoom = 1;

  function loadImage(name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `assets/${name}`;
    });
  }

  function tiled(context, img, x, y, scale) {
    const width = W * scale;
    const height = H * scale;
    const left = wrap(x, width) - width;
    const top = wrap(y, height) - height;
    for (let topY = top; topY < viewHeight; topY += height) {
      for (let leftX = left; leftX < viewWidth; leftX += width) {
        context.drawImage(img, leftX, topY, width, height);
      }
    }
  }

  function paint() {
    const [mosaic, mask, lettering] = images;
    const fit = Math.min(viewWidth * 0.96 / W, Math.max(1, viewHeight - LINK_SPACE) * 0.9 / H);
    const width = W * fit * state.zoom;
    const height = H * fit * state.zoom;
    const left = (viewWidth - width) / 2 + state.panX;
    const top = (viewHeight - LINK_SPACE - height) / 2 + state.panY;
    const scale = tileScale * state.zoom;
    const x = (viewWidth - W * scale) / 2 + state.panX - (state.travel + state.x + state.hoverX) * scale;
    const y = (viewHeight - H * scale) / 2 + state.panY + (state.y + state.hoverY) * scale;

    // One continuous mosaic covers the viewport, including the letter interiors.
    // The stationary mask only changes brightness; there is no second scrolling layer.
    tiled(ctx, mosaic, x, y, scale);
    // Cache the fixed text and shading at display resolution. Only zooming,
    // panning or resizing requires rebuilding this high-resolution overlay.
    const bounds = [left, top, width, height];
    if (!overlayBounds || bounds.some((value, i) => value !== overlayBounds[i])) {
      ink.clearRect(0, 0, viewWidth, viewHeight);
      ink.fillStyle = shade;
      ink.fillRect(0, 0, viewWidth, viewHeight);
      ink.globalCompositeOperation = "destination-out";
      ink.drawImage(mask, left, top, width, height);
      ink.globalCompositeOperation = "source-over";
      ink.drawImage(lettering, left, top, width, height);
      overlayBounds = bounds;
    }
    ctx.drawImage(layer, 0, 0, viewWidth, viewHeight);
  }

  function tick(time) {
    frame = 0;
    if (document.hidden) { previousTime = 0; return; }
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    if (!state.paused && !pointers.size) state.travel += dt * 18;

    let moving = false;
    const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 12);
    for (const key of ["x", "y", "hoverX", "hoverY", "zoom", "panX", "panY"]) {
      const target = state[`target${key[0].toUpperCase()}${key.slice(1)}`];
      const delta = target - state[key];
      if (Math.abs(delta) > 0.001) moving = true;
      state[key] = Math.abs(delta) < 0.001 ? target : state[key] + delta * easing;
    }
    paint();
    if (!state.paused || moving) wake();
    else previousTime = 0;
  }

  function wake() {
    if (images && !frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize() {
    viewWidth = artwork.clientWidth;
    viewHeight = artwork.clientHeight;
    const resolution = Math.min(3, devicePixelRatio || 1, Math.sqrt(MAX_RENDER_PIXELS / (viewWidth * viewHeight)));
    tileScale = Math.max(0.65, viewWidth / W);
    canvas.width = layer.width = Math.round(viewWidth * resolution);
    canvas.height = layer.height = Math.round(viewHeight * resolution);
    ctx.setTransform(canvas.width / viewWidth, 0, 0, canvas.height / viewHeight, 0, 0);
    ink.setTransform(layer.width / viewWidth, 0, 0, layer.height / viewHeight, 0, 0);
    ctx.imageSmoothingEnabled = ink.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = ink.imageSmoothingQuality = "high";
    overlayBounds = null;
    shade = ink.createLinearGradient(0, 0, 0, viewHeight);
    shade.addColorStop(0, "rgba(4,12,19,.87)");
    shade.addColorStop(0.45, "rgba(4,12,19,.80)");
    shade.addColorStop(1, "rgba(4,12,19,.87)");
    watchPixelRatio();
    constrainPan();
    paint();
    wake();
  }

  function constrainPan() {
    const limitX = artwork.clientWidth * (state.targetZoom - 1) / 2;
    const limitY = artwork.clientHeight * (state.targetZoom - 1) / 2;
    state.targetPanX = clamp(state.targetPanX, -limitX, limitX);
    state.targetPanY = clamp(state.targetPanY, -limitY, limitY);
  }

  function watchPixelRatio() {
    // Moving the window between monitors can change DPR without changing its CSS size.
    pixelRatioQuery?.removeEventListener("change", resize);
    pixelRatioQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    pixelRatioQuery.addEventListener("change", resize, { once: true });
  }

  function zoomTo(value) {
    state.targetZoom = clamp(value, 1, 3);
    state.targetHoverX = state.targetHoverY = 0;
    constrainPan();
    wake();
  }

  function toggleMotion() {
    state.paused = !state.paused;
    status.textContent = state.paused ? "Animation paused." : "Animation playing.";
    wake();
  }

  function reset() {
    state.travel = 0;
    for (const key of ["X", "Y", "HoverX", "HoverY", "PanX", "PanY"]) state[`target${key}`] = 0;
    zoomTo(1);
    status.textContent = "View reset.";
  }

  canvas.addEventListener("wheel", event => {
    // Keep browser zoom shortcuts available.
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H : 1;
    state.targetX += clamp((event.deltaY + event.deltaX) * unit, -500, 500) * 0.65;
    wake();
  }, { passive: false });

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    clearTimeout(clickTimer);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    lastPointer = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      downAt = { ...lastPointer };
      dragged = false;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = state.targetZoom;
      dragged = true;
    }
    artwork.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", event => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (pinchDistance > 0) zoomTo(pinchZoom * Math.hypot(a.x - b.x, a.y - b.y) / pinchDistance);
      } else if (pointers.size === 1 && lastPointer) {
        const dx = event.clientX - lastPointer.x;
        const dy = event.clientY - lastPointer.y;
        if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) dragged = true;
        if (state.targetZoom > 1.05) {
          state.targetPanX += dx;
          state.targetPanY += dy;
          constrainPan();
        } else {
          const ratio = 1 / tileScale;
          state.targetX -= dx * ratio;
          state.targetY += dy * ratio;
        }
        wake();
      }
      lastPointer = { x: event.clientX, y: event.clientY };
    } else if (event.pointerType === "mouse" && !reducedMotion.matches && state.targetZoom <= 1.05) {
      const bounds = artwork.getBoundingClientRect();
      state.targetHoverX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 24;
      state.targetHoverY = -((event.clientY - bounds.top) / bounds.height - 0.5) * 18;
      wake();
    }
  });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (event.type === "pointercancel") dragged = true;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    lastPointer = pointers.size ? [...pointers.values()][0] : null;
    if (!pointers.size) {
      artwork.classList.remove("is-dragging");
      pinchDistance = 0;
    }
    wake();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", endPointer);
  canvas.addEventListener("pointerleave", () => {
    state.targetHoverX = state.targetHoverY = 0;
    wake();
  });

  canvas.addEventListener("click", event => {
    if (dragged || event.detail > 1) return;
    clickTimer = setTimeout(toggleMotion, 250);
  });
  canvas.addEventListener("dblclick", event => {
    event.preventDefault();
    clearTimeout(clickTimer);
    if (!dragged) zoomTo(state.targetZoom > 1.05 ? 1 : 1.8);
  });

  canvas.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case " ": toggleMotion(); break;
      case "ArrowRight": state.targetX += 80; break;
      case "ArrowLeft": state.targetX -= 80; break;
      case "ArrowUp": state.targetY += 40; break;
      case "ArrowDown": state.targetY -= 40; break;
      case "+": case "=": zoomTo(state.targetZoom + 0.25); break;
      case "-": case "_": zoomTo(state.targetZoom - 0.25); break;
      case "Escape": case "Home": reset(); break;
      default: return;
    }
    event.preventDefault();
    wake();
  });

  reducedMotion.addEventListener("change", event => {
    state.paused = event.matches;
    state.targetHoverX = state.targetHoverY = 0;
    wake();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      pointers.clear();
      lastPointer = null;
      artwork.classList.remove("is-dragging");
    } else wake();
  });

  Promise.all(["mosaic.webp", "wordmark-mask.png", "lettering.webp"].map(loadImage))
    .then(loaded => {
      images = loaded;
      resize();
      canvas.hidden = false;
      artwork.classList.add("is-ready");
      document.querySelector(".fallback").setAttribute("aria-hidden", "true");
      new ResizeObserver(resize).observe(artwork);
      window.addEventListener("resize", resize);
    })
    .catch(() => {
      // The static full-screen artwork stays visible if canvas assets cannot load.
      canvas.remove();
    });
})();
