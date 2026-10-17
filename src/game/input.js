/** Maps physical keys to logical actions. Several keys may share an action. */
const KEY_MAP = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  KeyE: "interact",
  Space: "interact",
  Escape: "cancel",
  KeyR: "restart",
};

const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export function createInput(target = window) {
  const keysDown = new Set();
  const pressedActions = new Set();

  const onKeyDown = (event) => {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keysDown.add(event.code);
    pressedActions.add(action);
  };

  const onKeyUp = (event) => {
    if (!KEY_MAP[event.code]) return;
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    keysDown.delete(event.code);
  };

  const clearKeys = () => {
    keysDown.clear();
    pressedActions.clear();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", clearKeys);

  const isDown = (action) => {
    for (const code of keysDown) {
      if (KEY_MAP[code] === action) return true;
    }
    return false;
  };

  return {
    isDown,
    consume(action) {
      if (!pressedActions.has(action)) return false;
      pressedActions.delete(action);
      return true;
    },
    endFrame() {
      pressedActions.clear();
    },
    reset: clearKeys,
    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", clearKeys);
      clearKeys();
    },
  };
}
