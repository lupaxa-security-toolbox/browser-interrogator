/**
 * Sponsor page: load the Ko-fi frame only after the visitor asks for it.
 */
(() => {
  "use strict";

  const widget = document.querySelector(".sponsor-widget");
  if (!widget) return;

  const button = widget.querySelector(".sponsor-widget-open");
  const frame = widget.querySelector("#kofiframe");
  if (!button || !frame) return;

  button.addEventListener("click", () => {
    const src = frame.getAttribute("data-src");
    if (!src || frame.getAttribute("src")) return;
    frame.src = src;
    frame.hidden = false;
    button.hidden = true;
    widget.classList.add("is-open");
  });
})();
