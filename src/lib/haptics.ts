/**
 * Forceful Haptic Vibration Helper for Web & Mobile Devices
 * Supports navigator.vibrate across Android browsers, PWAs, Chrome, Edge, and Samsung Internet.
 */
export function triggerHapticFeedback(pattern: "coin" | "success" | "heavy" | "error" = "coin") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;

  try {
    let vibePattern: number[];
    switch (pattern) {
      case "coin":
        // Distinct forceful coin collection vibration burst (Heavy bump - pause - double energetic thud)
        vibePattern = [120, 40, 160, 40, 220];
        break;
      case "heavy":
        // Intense long forceful pulse
        vibePattern = [300, 80, 400];
        break;
      case "success":
        vibePattern = [80, 50, 100];
        break;
      case "error":
        vibePattern = [150, 60, 150, 60, 250];
        break;
      default:
        vibePattern = [100, 50, 100];
    }
    navigator.vibrate(vibePattern);
  } catch (err) {
    console.debug("[haptics] Vibration not allowed or supported:", err);
  }
}

