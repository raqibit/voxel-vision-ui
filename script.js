(() => {
  "use strict";

  const body = document.body;
  const canvas = document.getElementById("form-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const sceneWrap = document.querySelector(".scene-wrap");
  const motionToggle = document.getElementById("motion-toggle");
  const themeToggle = document.getElementById("theme-toggle");
  const nav = document.querySelector(".nav-pills");
  const menuButton = document.querySelector(".menu-button");

  let animationRunning = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let elapsed = 0;
  let previousFrame = performance.now();
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resizeCanvas() {
    const rect = sceneWrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rotate(point, ax, ay) {
    let { x, y, z } = point;
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    return { x: x1, y: y * cx - z1 * sx, z: y * sx + z1 * cx };
  }

  function makePoint(lat, lon, time) {
    const ripple =
      1 +
      0.13 * Math.sin(lon * 4 + time * 0.85) * Math.cos(lat * 3 - time * 0.45) +
      0.09 * Math.sin(lon * 7 - lat * 2 + time * 0.7) +
      0.045 * Math.cos(lat * 9 + time);
    const flare = 1 + 0.08 * Math.max(0, Math.sin(lon * 3 - time * 0.35));
    const radius = ripple * flare;
    return {
      x: radius * Math.cos(lat) * Math.cos(lon),
      y: radius * Math.sin(lat),
      z: radius * Math.cos(lat) * Math.sin(lon),
    };
  }

  function project(point, scale) {
    const perspective = 3.6 / (4.2 - point.z);
    return {
      x: width * 0.5 + point.x * scale * perspective,
      y: height * 0.5 + point.y * scale * perspective,
      z: point.z,
    };
  }

  function drawBackgroundDetails(time) {
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(-0.22 + pointerX * 0.08);
    for (let i = 0; i < 3; i += 1) {
      const rx = width * (0.23 + i * 0.055);
      const ry = height * (0.12 + i * 0.032);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, time * 0.025 * (i % 2 ? -1 : 1), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(203, 198, 255, ${0.16 - i * 0.035})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 44; i += 1) {
      const seed = i * 97.31;
      const x = ((Math.sin(seed) + 1) * 0.5) * width;
      const y = ((Math.sin(seed * 0.47) + 1) * 0.5) * height;
      const pulse = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 0.7 + seed));
      ctx.fillStyle = `rgba(226, 223, 255, ${pulse})`;
      ctx.fillRect(x, y, i % 5 === 0 ? 1.6 : 0.8, i % 5 === 0 ? 1.6 : 0.8);
    }
  }

  function drawForm(time) {
    ctx.clearRect(0, 0, width, height);
    drawBackgroundDetails(time);

    pointerX += (targetX - pointerX) * 0.055;
    pointerY += (targetY - pointerY) * 0.055;

    const latitudeBands = 17;
    const longitudeBands = 34;
    const scale = Math.min(width, height) * 0.43;
    const points = [];

    for (let latIndex = 0; latIndex <= latitudeBands; latIndex += 1) {
      const lat = -Math.PI / 2 + (latIndex / latitudeBands) * Math.PI;
      const row = [];
      for (let lonIndex = 0; lonIndex <= longitudeBands; lonIndex += 1) {
        const lon = (lonIndex / longitudeBands) * Math.PI * 2;
        const point = makePoint(lat, lon, time);
        const rotated = rotate(
          point,
          -0.24 + pointerY * 0.34 + Math.sin(time * 0.19) * 0.05,
          time * 0.12 + pointerX * 0.48,
        );
        row.push({ raw: rotated, screen: project(rotated, scale) });
      }
      points.push(row);
    }

    const faces = [];
    for (let lat = 0; lat < latitudeBands; lat += 1) {
      for (let lon = 0; lon < longitudeBands; lon += 1) {
        const p1 = points[lat][lon];
        const p2 = points[lat + 1][lon];
        const p3 = points[lat + 1][lon + 1];
        const p4 = points[lat][lon + 1];
        faces.push({ points: [p1, p2, p3, p4], depth: (p1.raw.z + p2.raw.z + p3.raw.z + p4.raw.z) / 4 });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);

    faces.forEach((face) => {
      const brightness = Math.max(0, Math.min(1, (face.depth + 1.45) / 2.9));
      const hue = body.classList.contains("light") ? 232 + brightness * 11 : 238 + brightness * 18;
      const lightness = body.classList.contains("light") ? 38 + brightness * 34 : 26 + brightness * 45;
      ctx.beginPath();
      ctx.moveTo(face.points[0].screen.x, face.points[0].screen.y);
      for (let i = 1; i < face.points.length; i += 1) {
        ctx.lineTo(face.points[i].screen.x, face.points[i].screen.y);
      }
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 78%, ${lightness}%, ${0.79 + brightness * 0.16})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(214, 210, 255, ${0.035 + brightness * 0.12})`;
      ctx.lineWidth = 0.42;
      ctx.stroke();
    });

    const sheen = ctx.createRadialGradient(width * 0.39, height * 0.31, 0, width * 0.42, height * 0.35, scale * 0.9);
    sheen.addColorStop(0, "rgba(255,255,255,0.24)");
    sheen.addColorStop(0.22, "rgba(198,193,255,0.08)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, scale * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }

  function animate(now) {
    const delta = Math.min(40, now - previousFrame) / 1000;
    previousFrame = now;
    if (animationRunning) elapsed += delta;
    drawForm(elapsed);
    requestAnimationFrame(animate);
  }

  sceneWrap.addEventListener("pointermove", (event) => {
    const rect = sceneWrap.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });
  sceneWrap.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; });

  motionToggle.addEventListener("click", () => {
    animationRunning = !animationRunning;
    const icon = motionToggle.querySelector(".pause-icon");
    const label = motionToggle.querySelector(".control-label");
    icon.classList.toggle("playing-icon", !animationRunning);
    label.textContent = animationRunning ? "Pause form" : "Play form";
    motionToggle.setAttribute("aria-label", animationRunning ? "Pause 3D animation" : "Play 3D animation");
  });

  themeToggle.addEventListener("click", () => {
    body.classList.toggle("light");
    const light = body.classList.contains("light");
    themeToggle.querySelector(".sun-icon").textContent = light ? "◐" : "☼";
    themeToggle.querySelector(".control-label").textContent = light ? "Dark mode" : "Light mode";
    themeToggle.setAttribute("aria-label", light ? "Use dark theme" : "Use light theme");
  });

  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.scroll;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      nav.classList.remove("is-open");
      menuButton.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open menu");
    });
  });

  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuButton.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  const testimonials = [
    { name: "Ari", role: "Product designer" },
    { name: "Jules", role: "3D artist" },
    { name: "Sam", role: "Creative lead" },
  ];
  let testimonialIndex = 0;
  function updateTestimonial(direction) {
    testimonialIndex = (testimonialIndex + direction + testimonials.length) % testimonials.length;
    document.getElementById("creator-name").textContent = testimonials[testimonialIndex].name;
    document.getElementById("creator-role").textContent = testimonials[testimonialIndex].role;
    document.querySelectorAll(".avatar-row span").forEach((avatar, index) => {
      avatar.classList.toggle("selected", index === testimonialIndex);
    });
  }
  document.getElementById("testimonial-prev").addEventListener("click", () => updateTestimonial(-1));
  document.getElementById("testimonial-next").addEventListener("click", () => updateTestimonial(1));

  const sections = [...document.querySelectorAll("section[id]")];
  const navButtons = [...document.querySelectorAll(".nav-pills [data-scroll]")];
  const activeObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.scroll === visible.target.id));
  }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.4] });
  sections.forEach((section) => activeObserver.observe(section));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));

  window.addEventListener("resize", resizeCanvas, { passive: true });
  resizeCanvas();
  requestAnimationFrame(animate);
})();
