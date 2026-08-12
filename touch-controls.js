// ---------------------------------------------------------------------------
// Touch controls: a virtual joystick that drives the same `keys` Set the
// keyboard path already uses, plus an interact button and panel buttons that
// dispatch the same synthetic keydown events the real handlers listen for.
// Only shown on touch devices (gated in style.css) — desktop is unaffected.
// ---------------------------------------------------------------------------

const JOYSTICK_MAX_RADIUS = 40; // px, clamp for the visual knob travel
const JOYSTICK_DEAD_ZONE = 10; // px, ignore tiny jitter near center

function dispatchKey(key) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

function setupJoystick() {
  const base = document.getElementById("touch-joystick");
  const knob = document.getElementById("touch-joystick-knob");
  let activeTouchId = null;
  let originX = 0;
  let originY = 0;

  // Buckets the drag angle into 8 directions and sets the matching w/a/s/d
  // combination — diagonal movement already works today since two keys can
  // be in the Set at once, so this needs zero changes to update()'s movement.
  function updateDirection(dx, dy) {
    ["w", "a", "s", "d"].forEach((k) => keys.delete(k));
    if (Math.hypot(dx, dy) < JOYSTICK_DEAD_ZONE) return;

    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    if (sector === 0 || sector === 1 || sector === -1) keys.add("d");
    if (sector === 4 || sector === -4 || sector === 3 || sector === -3) keys.add("a");
    if (sector === 2 || sector === 1 || sector === 3) keys.add("s");
    if (sector === -2 || sector === -1 || sector === -3) keys.add("w");
  }

  function handleMove(clientX, clientY) {
    const dx = clientX - originX;
    const dy = clientY - originY;
    const dist = Math.min(JOYSTICK_MAX_RADIUS, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    knob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    updateDirection(dx, dy);
  }

  function reset() {
    activeTouchId = null;
    knob.style.transform = "translate(0, 0)";
    ["w", "a", "s", "d"].forEach((k) => keys.delete(k));
  }

  base.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      const rect = base.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      handleMove(touch.clientX, touch.clientY);
    },
    { passive: false }
  );

  base.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const touch = [...e.changedTouches].find((t) => t.identifier === activeTouchId);
      if (touch) handleMove(touch.clientX, touch.clientY);
    },
    { passive: false }
  );

  function handleEnd(e) {
    const touch = [...e.changedTouches].find((t) => t.identifier === activeTouchId);
    if (touch) reset();
  }
  base.addEventListener("touchend", handleEnd);
  base.addEventListener("touchcancel", handleEnd);
}

function setupTouchButtons() {
  const bindings = [
    ["touch-interact-btn", "e"],
    ["touch-inv-btn", "i"],
    ["touch-char-btn", "c"],
    ["touch-craft-btn", "r"],
    ["touch-quest-btn", "q"],
    ["touch-map-btn", "m"],
  ];
  bindings.forEach(([id, key]) => {
    document.getElementById(id).addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        dispatchKey(key);
      },
      { passive: false }
    );
  });
}

// Hides the mobile browser's own chrome (address bar etc.) for a more
// immersive, app-like view. Requires a user gesture to invoke, so it's a
// toggle button rather than something triggered automatically on load.
function setupFullscreenToggle() {
  document.getElementById("touch-fullscreen-btn").addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    },
    { passive: false }
  );
}

setupJoystick();
setupTouchButtons();
setupFullscreenToggle();
