/**
 * Keep the custom header navigation active state synchronised with
 * MkDocs Material instant navigation.
 *
 * Home is exact-match only so the site root does not light up on every
 * nested page. Other items use every descendant URL in data-nav-prefixes.
 *
 * Header hrefs are page-relative. Instant navigation keeps the header and
 * changes the document URL, so resolving those hrefs again would point at
 * the wrong place. Snapshot each link's paths on first paint.
 */

(() => {
  "use strict";

  const { onPageRender } = window.LupaxaPageLifecycle;

  /**
   * @param {string} value
   * @param {string} base
   * @returns {string}
   */
  const normalisePath = (value, base) => {
    const url = new URL(value, base);

    const path = url.pathname
      .replace(/\/index\.html$/, "/")
      .replace(/\/+$/, "");

    return path || "/";
  };

  /**
   * Resolve and store paths from the header as first rendered.
   *
   * @param {HTMLAnchorElement} link
   */
  const snapshotLink = (link) => {
    if (link.dataset.navResolved === "true") {
      return;
    }

    const base = document.baseURI;

    link.dataset.resolvedPath = normalisePath(
      link.getAttribute("href") || link.href,
      base,
    );

    const raw = link.getAttribute("data-nav-prefixes") || "";
    const prefixes = raw
      .split(/\s+/)
      .filter(Boolean)
      .map((prefix) => normalisePath(prefix, base));

    link.dataset.resolvedPrefixes = (
      prefixes.length ? prefixes : [link.dataset.resolvedPath]
    ).join(" ");
    link.dataset.navResolved = "true";
  };

  /**
   * @param {string} currentPath
   * @param {string} prefix
   * @returns {boolean}
   */
  const pathMatches = (currentPath, prefix) =>
    currentPath === prefix || currentPath.startsWith(`${prefix}/`);

  const updateActiveNavigation = () => {
    const currentPath = normalisePath(
      window.location.href,
      window.location.href,
    );
    const links = Array.from(
      document.querySelectorAll(".lupaxa-header__nav-link"),
    );

    if (!links.length) {
      return;
    }

    links.forEach(snapshotLink);

    // Home is the first top-level item (site convention).
    const homePath = links[0].dataset.resolvedPath;

    links.forEach((link) => {
      const item = link.closest(".lupaxa-header__nav-item");

      if (!item) {
        return;
      }

      const linkPath = link.dataset.resolvedPath;
      const isHome = linkPath === homePath;
      const prefixes = (link.dataset.resolvedPrefixes || "")
        .split(/\s+/)
        .filter(Boolean);
      const isActive = isHome
        ? currentPath === linkPath
        : prefixes.some((prefix) => pathMatches(currentPath, prefix));

      item.classList.toggle(
        "lupaxa-header__nav-item--active",
        isActive,
      );

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const scheduleUpdate = () => {
    requestAnimationFrame(updateActiveNavigation);
  };

  onPageRender(updateActiveNavigation);
  window.addEventListener("popstate", scheduleUpdate);
})();
