import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

function writeClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => { fallbackCopy(text); resolve(); });
}

export default function GlobalBehaviors() {
  const location = useLocation();

  useEffect(() => {
    function onClick(e) {
      const cb = e.target.closest(".copy-btn");
      if (cb) {
        const block = cb.closest(".code-block") || cb.parentElement;
        const pre = block
          ? Array.prototype.slice.call(block.querySelectorAll("pre")).find(
              (p) => p.style.display !== "none"
            )
          : null;
        if (pre) {
          const label = cb.querySelector("span");
          writeClipboard(pre.innerText).then(() => {
            if (label) {
              label.textContent = "Copied";
              setTimeout(() => { label.textContent = "Copy"; }, 1600);
            }
          });
        }
        return;
      }
    }

    document.addEventListener("click", onClick);

    let observer;
    const revealed = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      revealed.forEach((el) => observer.observe(el));
    } else {
      revealed.forEach((el) => el.classList.add("visible"));
    }

    return () => {
      document.removeEventListener("click", onClick);
      if (observer) observer.disconnect();
    };
  }, [location.pathname]);

  return null;
}