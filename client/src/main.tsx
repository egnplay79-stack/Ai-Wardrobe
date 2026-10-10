import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import { AIService } from "./services/AIService";
import { WardrobeService } from "./services/WardrobeService";

AIService.init();
const loaded = WardrobeService.init();

/** Hide the launch logo once the wardrobe is loaded (shown at least briefly, never stuck). */
const splash = document.getElementById("splash");
if (splash) {
  const minShown = new Promise((r) => setTimeout(r, 700));
  const maxWait = new Promise((r) => setTimeout(r, 4000));
  Promise.race([Promise.all([loaded.catch(() => undefined), minShown]), maxWait]).then(() => {
    splash.classList.add("out");
    setTimeout(() => splash.remove(), 450);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
