/**
 * Fill the Interrogate Me tables from this browser and from a lookup of the
 * public address that requested the page.
 */

(() => {
  "use strict";

  const { onPageRender } = window.LupaxaPageLifecycle;

  const LOOKUP_URL = "https://ipwho.is/";
  const LOOKUP_FALLBACKS = ["https://ipapi.co/json/", "https://freeipapi.com/api/json"];
  const EU_COUNTRIES = new Set(
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "),
  );
  const CONTINENTS = {
    AF: "Africa",
    AN: "Antarctica",
    AS: "Asia",
    EU: "Europe",
    NA: "North America",
    OC: "Oceania",
    SA: "South America",
  };
  const HANDSHAKE_URL = "https://kittens.sh/api/all?pretty=0";
  const STUN_URL = "stun:stun.l.google.com:19302";
  const DNS_URL = "https://cloudflare-dns.com/dns-query";
  const RDAP_URL = "https://rdap.org/ip/";
  const FONT_CANDIDATES = [
    "Segoe UI",
    "Calibri",
    "Cambria",
    "Candara",
    "Consolas",
    "Constantia",
    "Corbel",
    "Tahoma",
    "Verdana",
    "Trebuchet MS",
    "Georgia",
    "Impact",
    "Comic Sans MS",
    "Lucida Console",
    "Helvetica Neue",
    "Avenir",
    "Avenir Next",
    "Gill Sans",
    "Futura",
    "Baskerville",
    "Hoefler Text",
    "Didot",
    "American Typewriter",
    "Menlo",
    "Monaco",
    "PingFang SC",
    "Hiragino Sans",
    "Apple SD Gothic Neo",
    "Ubuntu",
    "Cantarell",
    "DejaVu Sans",
    "Liberation Sans",
    "Nimbus Sans",
    "FreeSans",
  ];

  /**
   * @param {unknown} value
   * @returns {string}
   */
  const shown = (value) => {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }
    return String(value);
  };

  /**
   * @param {boolean | null | undefined} value
   * @returns {string}
   */
  const yesNo = (value) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Not available";
  };

  /**
   * @param {number} minutes East of UTC is positive.
   * @returns {string}
   */
  const utcOffset = (minutes) => {
    const sign = minutes >= 0 ? "+" : "-";
    const absolute = Math.abs(minutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
    const mins = String(absolute % 60).padStart(2, "0");
    return `UTC${sign}${hours}:${mins}`;
  };

  /**
   * @param {number} bytes
   * @returns {string}
   */
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return "Not available";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    const digits = size >= 10 || unit === 0 ? 0 : 1;
    return `${size.toFixed(digits)} ${units[unit]}`;
  };

  /**
   * @param {string} query
   * @returns {string | null}
   */
  const media = (query) => (window.matchMedia(query).matches ? query : null);

  /**
   * @param {HTMLTableElement} table
   * @param {Array<[string, string]>} rows
   */
  const render = (table, rows) => {
    const body = table.tBodies[0];
    body.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement("tr");
        const labelCell = document.createElement("td");
        const valueCell = document.createElement("td");
        labelCell.textContent = label;
        valueCell.textContent = shown(value);
        row.append(labelCell, valueCell);
        return row;
      }),
    );
  };

  /**
   * @param {string} url
   * @returns {Promise<Record<string, unknown> | null>}
   */
  const readJson = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== "object") return null;
    return payload;
  };

  /**
   * @param {string} code
   * @returns {string}
   */
  const flagEmoji = (code) => {
    if (!/^[A-Za-z]{2}$/.test(code)) return "";
    const points = [...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
    return String.fromCodePoint(...points);
  };

  /**
   * @param {string} timeZone
   * @param {Date} date
   * @returns {number | null}
   */
  const zoneOffsetMinutes = (timeZone, date) => {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hourCycle: "h23",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
          .formatToParts(date)
          .map((part) => [part.type, part.value]),
      );
      const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      );
      return Math.round((asUtc - date.getTime()) / 60000);
    } catch {
      return null;
    }
  };

  /**
   * @param {string} timeZone
   * @param {string} utcText
   * @returns {Record<string, unknown>}
   */
  const zoneDetails = (timeZone, utcText) => {
    /** @type {Record<string, unknown>} */
    const zone = {};
    if (timeZone) zone.id = timeZone;
    const match = typeof utcText === "string" ? utcText.match(/^([+-])(\d{2}):?(\d{2})$/) : null;
    if (match) zone.utc = `${match[1]}${match[2]}:${match[3]}`;
    if (!timeZone) return zone;
    try {
      const abbr = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName");
      if (abbr && abbr.value && abbr.value !== timeZone) zone.abbr = abbr.value;
    } catch {
      /* An unknown zone id still leaves the id itself. */
    }
    const now = new Date();
    const current = zoneOffsetMinutes(timeZone, now);
    const winter = zoneOffsetMinutes(timeZone, new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
    const summer = zoneOffsetMinutes(timeZone, new Date(Date.UTC(now.getUTCFullYear(), 6, 1)));
    if (current != null && winter != null && summer != null) {
      if (!zone.utc) {
        const sign = current >= 0 ? "+" : "-";
        const absolute = Math.abs(current);
        zone.utc = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
      }
      zone.is_dst = winter !== summer && current === Math.max(winter, summer);
    }
    return zone;
  };

  /**
   * ipapi.co uses different names from ipwho.is. Fold it into that shape.
   *
   * @param {Record<string, unknown> | null} payload
   * @returns {Record<string, unknown> | null}
   */
  const fromIpapi = (payload) => {
    if (!payload || typeof payload.ip !== "string" || !payload.ip) return null;
    const countryCode = typeof payload.country === "string" ? payload.country : "";
    const continentCode = typeof payload.continent_code === "string" ? payload.continent_code : "";
    const asn = typeof payload.asn === "string" ? payload.asn.replace(/^AS/i, "") : "";
    return {
      ip: payload.ip,
      type: payload.version || "",
      city: payload.city || "",
      region: payload.region || "",
      region_code: payload.region_code || "",
      country: payload.country_name || "",
      country_code: countryCode,
      continent: CONTINENTS[continentCode] || "",
      continent_code: continentCode,
      postal: payload.postal || "",
      latitude: payload.latitude,
      longitude: payload.longitude,
      capital: payload.country_capital || "",
      calling_code: payload.country_calling_code || "",
      is_eu: payload.in_eu,
      flag: { emoji: flagEmoji(countryCode) },
      connection: {
        asn,
        org: payload.org || "",
        isp: payload.org || "",
      },
      timezone: zoneDetails(
        typeof payload.timezone === "string" ? payload.timezone : "",
        typeof payload.utc_offset === "string" ? payload.utc_offset : "",
      ),
    };
  };

  /**
   * @param {Record<string, unknown> | null} payload
   * @returns {Record<string, unknown> | null}
   */
  const fromFreeIp = (payload) => {
    if (!payload || typeof payload.ipAddress !== "string" || !payload.ipAddress) return null;
    const countryCode = typeof payload.countryCode === "string" ? payload.countryCode : "";
    const continentCode = typeof payload.continentCode === "string" ? payload.continentCode : "";
    const zone = Array.isArray(payload.timeZones) ? payload.timeZones.find((item) => typeof item === "string") : "";
    const calling = Array.isArray(payload.phoneCodes)
      ? payload.phoneCodes.map((item) => `+${item}`).join(", ")
      : "";
    const asn = typeof payload.asn === "string" ? payload.asn.replace(/^AS/i, "") : "";
    return {
      ip: payload.ipAddress,
      type: payload.ipVersion === 4 ? "IPv4" : payload.ipVersion === 6 ? "IPv6" : "",
      city: payload.cityName || "",
      region: payload.regionName || "",
      region_code: payload.regionCode || "",
      country: payload.countryName || "",
      country_code: countryCode,
      continent: payload.continent || CONTINENTS[continentCode] || "",
      continent_code: continentCode,
      postal: payload.zipCode || "",
      latitude: payload.latitude,
      longitude: payload.longitude,
      capital: payload.capital || "",
      calling_code: calling,
      is_eu: EU_COUNTRIES.has(countryCode),
      flag: { emoji: flagEmoji(countryCode) },
      proxy: typeof payload.isProxy === "boolean" ? payload.isProxy : null,
      connection: {
        asn,
        org: payload.asnOrganization || "",
        isp: payload.asnOrganization || "",
      },
      timezone: zoneDetails(typeof zone === "string" ? zone : "", ""),
    };
  };

  /**
   * @returns {Promise<Record<string, unknown> | null>}
   */
  const lookupAddress = async () => {
    const ipwho = await readJson(LOOKUP_URL);
    if (ipwho && ipwho.success !== false && typeof ipwho.ip === "string" && ipwho.ip) return ipwho;
    const ipapi = fromIpapi(await readJson(LOOKUP_FALLBACKS[0]));
    if (ipapi) return ipapi;
    return fromFreeIp(await readJson(LOOKUP_FALLBACKS[1]));
  };

  /**
   * JA3, JA4, and header order, as seen by a public TLS terminator.
   * GitHub Pages never sees the ClientHello, so the page cannot compute this.
   * @returns {Promise<Record<string, unknown> | null>}
   */
  const lookupHandshake = async () => {
    const response = await fetch(HANDSHAKE_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload.ja4 !== "string") return null;
    return payload;
  };

  /**
   * @param {unknown} items
   * @returns {string}
   */
  const namedList = (items) => {
    if (!Array.isArray(items)) return "";
    return items
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item.name !== "string" || !item.name) return "";
        return item.grease ? `${item.name} (GREASE)` : item.name;
      })
      .filter(Boolean)
      .join(", ");
  };

  /**
   * @param {unknown} value
   * @returns {string[]}
   */
  const headerLines = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (Array.isArray(item) && item.length >= 2) return `${item[0]}: ${item[1]}`;
          if (item && typeof item === "object" && item.name != null) {
            return `${item.name}: ${item.value ?? ""}`;
          }
          return "";
        })
        .filter(Boolean);
    }
    if (value && typeof value === "object") {
      return Object.entries(value).map(([name, item]) => `${name}: ${item}`);
    }
    return [];
  };

  /**
   * @template T
   * @param {Promise<T>} promise
   * @param {number} ms
   * @returns {Promise<T | null>}
   */
  const within = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((resolve) => {
        window.setTimeout(() => resolve(null), ms);
      }),
    ]);

  /**
   * @param {string} ip
   * @returns {string}
   */
  const reverseDnsName = (ip) => {
    const bare = ip.split("%")[0];
    if (bare.includes(".")) {
      const parts = bare.split(".");
      if (parts.length !== 4) return "";
      return `${parts.reverse().join(".")}.in-addr.arpa`;
    }
    const halves = bare.split("::");
    if (halves.length > 2) return "";
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return "";
    const groups = halves.length === 2 ? [...head, ...Array(missing).fill("0"), ...tail] : head;
    if (groups.length !== 8) return "";
    const nibbles = groups
      .map((group) => group.padStart(4, "0"))
      .join("")
      .split("")
      .reverse()
      .join(".");
    return `${nibbles}.ip6.arpa`;
  };

  /**
   * @param {string} ip
   * @returns {string}
   */
  const pathIp = (ip) => {
    const bare = String(ip).split("%")[0];
    return /^[0-9a-fA-F:.]+$/.test(bare) ? bare : "";
  };

  /**
   * @param {string} ip
   * @returns {Promise<string>}
   */
  const lookupHostname = async (ip) => {
    const safe = pathIp(ip);
    const name = reverseDnsName(safe);
    if (!name) return "";
    const response = await fetch(
      `${DNS_URL}?name=${encodeURIComponent(name)}&type=PTR`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return "";
    const payload = await response.json();
    const answer = (payload.Answer || []).find((item) => item.type === 12);
    return answer && answer.data ? String(answer.data).replace(/\.$/, "") : "No reverse name";
  };

  /**
   * @param {unknown[]} vcard
   * @returns {string[]}
   */
  const vcardEmails = (vcard) => {
    if (!Array.isArray(vcard)) return [];
    return vcard
      .filter((item) => Array.isArray(item) && item[0] === "email" && item[3])
      .map((item) => String(item[3]));
  };

  /**
   * @param {string} ip
   * @returns {Promise<Record<string, string> | null>}
   */
  const lookupRegistration = async (ip) => {
    const safe = pathIp(ip);
    if (!safe) return null;
    const response = await fetch(`${RDAP_URL}${safe}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const emails = [];
    for (const entity of payload.entities || []) {
      const roles = entity.roles || [];
      if (!roles.includes("abuse")) continue;
      emails.push(...vcardEmails(entity.vcardArray && entity.vcardArray[1]));
    }
    const cidr = (payload.cidr0_cidrs || [])
      .map((item) =>
        item.v4prefix
          ? `${item.v4prefix}/${item.length}`
          : item.v6prefix
            ? `${item.v6prefix}/${item.length}`
            : "",
      )
      .filter(Boolean)
      .join(", ");
    const registered = (payload.events || []).find(
      (event) => event.eventAction === "registration",
    );
    return {
      name: payload.name || "",
      cidr,
      type: payload.type || "",
      country: payload.country || "",
      status: Array.isArray(payload.status) ? payload.status.join(", ") : "",
      abuse: emails.join(", "),
      registered: registered && registered.eventDate ? String(registered.eventDate) : "",
    };
  };

  /**
   * @param {string} address
   * @returns {"local" | "name" | "public"}
   */
  const addressKind = (address) => {
    if (address.endsWith(".local")) return "name";
    if (!address.includes(":")) {
      const [first, second] = address.split(".").map((part) => Number(part));
      if (first === 10 || first === 127) return "local";
      if (first === 192 && second === 168) return "local";
      if (first === 172 && second >= 16 && second <= 31) return "local";
      if (first === 169 && second === 254) return "local";
      if (first === 100 && second >= 64 && second <= 127) return "local";
      return "public";
    }
    if (address === "::1") return "local";
    const head = address.split(":")[0].toLowerCase();
    if (/^fe[89ab]/.test(head)) return "local";
    const value = Number.parseInt(head || "0", 16);
    if (value >= 0xfc00 && value <= 0xfdff) return "local";
    return "public";
  };

  /**
   * @param {string} text
   * @returns {Promise<string>}
   */
  const sha256 = async (text) => {
    if (!crypto.subtle) return "";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  /**
   * Pull an address out of an ICE candidate line. Older browsers only put the
   * LAN address in this text, not on candidate.address.
   *
   * @param {string} line
   * @returns {string[]}
   */
  const addressesInCandidate = (line) => {
    if (!line) return [];
    const found = [];
    const parts = line.trim().replace(/^a=/, "").split(/\s+/);
    if (parts[0] && parts[0].startsWith("candidate:") && parts[4]) {
      found.push(parts[4]);
    }
    const dotted = line.match(/(?:\d{1,3}\.){3}\d{1,3}/g) || [];
    for (const address of dotted) {
      const octets = address.split(".").map((part) => Number(part));
      if (octets.every((octet) => octet <= 255) && address !== "0.0.0.0") {
        found.push(address);
      }
    }
    const grouped = line.match(/(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}/gi) || [];
    return [...found, ...grouped];
  };

  /**
   * @param {RTCPeerConnection} peer
   * @param {Set<string>} found
   */
  const collectSessionAddresses = (peer, found) => {
    const description = peer.localDescription;
    const sdp = description && description.sdp;
    if (!sdp) return;
    for (const line of sdp.split("\n")) {
      if (!line.includes("candidate:")) continue;
      for (const address of addressesInCandidate(line)) found.add(address);
    }
  };

  /**
   * The older leak: a peer connection with no STUN server. The browser used
   * to put the private LAN address in the host candidate.
   *
   * @returns {Promise<string[] | null>}
   */
  const localIpProbe = () =>
    new Promise((resolve) => {
      if (typeof RTCPeerConnection !== "function") {
        resolve(null);
        return;
      }
      const found = new Set();
      let settled = false;
      /** @type {RTCPeerConnection | null} */
      let peer = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (peer) {
          collectSessionAddresses(peer, found);
          peer.onicecandidate = null;
          peer.close();
        }
        resolve([...found]);
      };

      try {
        peer = new RTCPeerConnection({ iceServers: [] });
        peer.createDataChannel("probe");
        peer.onicecandidate = (event) => {
          if (!event.candidate) {
            finish();
            return;
          }
          if (event.candidate.address) found.add(event.candidate.address);
          for (const address of addressesInCandidate(event.candidate.candidate)) {
            found.add(address);
          }
        };
        peer
          .createOffer()
          .then((offer) => (peer ? peer.setLocalDescription(offer) : undefined))
          .catch(finish);
      } catch {
        finish();
        return;
      }

      window.setTimeout(finish, 2000);
    });

  /**
   * Addresses the browser announces while opening a peer connection.
   * Modern browsers often substitute a private name for a LAN address.
   *
   * @returns {Promise<{ addresses: string[], candidateTypes: string[], protocols: string[], networks: string[] } | null>}
   */
  const announcedAddresses = () =>
    new Promise((resolve) => {
      const found = new Set();
      const types = new Set();
      const protocols = new Set();
      const networks = new Set();
      let settled = false;
      /** @type {RTCPeerConnection | null} */
      let peer = null;

      const note = (candidate) => {
        if (!candidate) return;
        if (candidate.address) found.add(candidate.address);
        if (candidate.candidate) {
          for (const address of addressesInCandidate(candidate.candidate)) found.add(address);
        }
        if (candidate.type) types.add(candidate.type);
        if (candidate.protocol) protocols.add(candidate.protocol);
        if (candidate.networkType) networks.add(candidate.networkType);
      };

      const finish = async () => {
        if (settled) return;
        settled = true;
        if (peer) {
          collectSessionAddresses(peer, found);
          try {
            const report = await peer.getStats();
            for (const stat of report.values()) {
              if (stat.type !== "local-candidate") continue;
              if (stat.address) found.add(stat.address);
              if (stat.candidateType) types.add(stat.candidateType);
              if (stat.protocol) protocols.add(stat.protocol);
              if (stat.networkType && stat.networkType !== "unknown") networks.add(stat.networkType);
            }
          } catch {
            /* Gathering can close before stats are readable. */
          }
          peer.onicecandidate = null;
          peer.close();
        }
        resolve({
          addresses: [...found],
          candidateTypes: [...types],
          protocols: [...protocols],
          networks: [...networks],
        });
      };

      if (typeof RTCPeerConnection !== "function") {
        resolve(null);
        return;
      }

      try {
        peer = new RTCPeerConnection({ iceServers: [{ urls: STUN_URL }] });
        peer.createDataChannel("show-me");
        peer.onicecandidate = (event) => {
          if (!event.candidate) {
            finish();
            return;
          }
          note(event.candidate);
        };
        peer
          .createOffer()
          .then((offer) => peer && peer.setLocalDescription(offer))
          .catch(finish);
      } catch {
        finish();
        return;
      }

      window.setTimeout(finish, 2500);
    });

  /**
   * @param {Record<string, unknown> | null} payload
   * @param {{ addresses: string[], candidateTypes: string[], protocols: string[], networks: string[] } | null} ice
   * @param {string} hostname
   * @param {Record<string, string> | null} registration
   * @param {Record<string, unknown> | null} handshake
   * @param {string[] | null} localProbe
   * @returns {{ internet: Array<[string, string]>, web: Array<[string, string]> }}
   */
  const connectionRows = (payload, ice, hostname, registration, handshake, localProbe) => {
    const gathered = Boolean(ice && Array.isArray(ice.addresses));
    const addresses = gathered ? ice.addresses : [];
    const connection = /** @type {Record<string, unknown> | undefined} */ (
      payload && payload.connection
    );
    const zone = /** @type {Record<string, unknown> | undefined} */ (
      payload && payload.timezone
    );
    const link = /** @type {Record<string, unknown> | undefined} */ (
      navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection
    );
    const linkNames = {
      bluetooth: "Bluetooth",
      cellular: "Cellular",
      ethernet: "Ethernet",
      wifi: "Wi-Fi",
      wimax: "WiMAX",
      other: "Other",
      none: "None",
      unknown: "Unknown",
    };

    const asn = connection && connection.asn ? `AS${connection.asn}` : "";
    const country =
      payload && payload.country
        ? `${payload.country}${payload.country_code ? ` (${payload.country_code})` : ""}`
        : "";
    const coordinates =
      payload && payload.latitude != null && payload.longitude != null
        ? `${payload.latitude}, ${payload.longitude}`
        : "";
    const networkZone =
      zone && zone.id ? `${zone.id}${zone.abbr ? ` (${zone.abbr})` : ""}` : "";
    const networkOffset = zone && zone.utc ? `UTC${zone.utc}` : "";
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoneAgrees =
      zone && zone.id
        ? zone.id === browserZone
          ? "Yes"
          : `No. Browser is ${browserZone}, network is ${zone.id}`
        : "";
    const navigation = performance.getEntriesByType("navigation")[0];
    const localAddresses = addresses.filter((address) => addressKind(address) === "local");
    const publicAddresses = addresses.filter((address) => addressKind(address) === "public");
    const privateNames = addresses.filter((address) => addressKind(address) === "name");
    const probed = Array.isArray(localProbe) ? localProbe : [];
    const privateRank = (address) => {
      if (!address.includes(":")) {
        const first = Number(address.split(".")[0]);
        if (first === 10 || first === 172 || first === 192) return 0;
        if (first === 127) return 1;
        return 2;
      }
      if (address === "::1") return 1;
      return /^fe[89ab]/i.test(address.split(":")[0]) ? 3 : 2;
    };
    const returnedPrivate = [...new Set([...localAddresses, ...probed])]
      .filter((address) => addressKind(address) === "local")
      .sort((left, right) => privateRank(left) - privateRank(right) || left.localeCompare(right));
    const hiddenNames = [...new Set([...privateNames, ...probed.filter((address) => addressKind(address) === "name")])];
    const privateFromProbe =
      localProbe === null && addresses.length === 0
        ? ""
        : returnedPrivate.length
          ? returnedPrivate.join(", ")
          : hiddenNames.length
            ? "None. The browser replaced it with a private name."
            : "None";
    const lookupIp = payload && typeof payload.ip === "string" ? payload.ip : "";
    const publicAgrees = !lookupIp || !gathered
      ? ""
      : publicAddresses.length === 0
        ? "No public address was announced"
        : publicAddresses.includes(lookupIp)
          ? "Yes"
          : "No. The announced public address is not the lookup address.";
    const typeNames = {
      host: "Host",
      srflx: "Server reflexive",
      prflx: "Peer reflexive",
      relay: "Relay",
    };
    const networkNames = {
      bluetooth: "Bluetooth",
      cellular: "Cellular",
      ethernet: "Ethernet",
      wifi: "Wi-Fi",
      wimax: "WiMAX",
      vpn: "VPN",
      loopback: "Loopback",
    };
    const namedIce = (items, names) =>
      !gathered ? "" : items.length ? items.map((item) => names[item] || item).join(", ") : "None";
    const downlink =
      link && typeof link.downlink === "number" ? `${link.downlink} Mb/s` : "";
    const roundTrip = link && typeof link.rtt === "number" ? `${link.rtt} ms` : "";
    const linkType =
      link && typeof link.type === "string" ? linkNames[link.type] || link.type : "";

    const tls = /** @type {Record<string, unknown> | undefined} */ (
      handshake && handshake.tls
    );
    const http2 = /** @type {Record<string, unknown> | undefined} */ (
      handshake && handshake.http2
    );
    const http1 = /** @type {Record<string, unknown> | undefined} */ (
      handshake && handshake.http1
    );
    const headerNames = http2 && Array.isArray(http2.headers)
      ? http2.headers.map((pair) => (Array.isArray(pair) ? pair[0] : "")).filter(Boolean)
      : http1 && Array.isArray(http1.header_order)
        ? http1.header_order
        : [];
    const pseudo = http2 && Array.isArray(http2.pseudo_header_order)
      ? http2.pseudo_header_order
      : [];
    const seenHeaders = [
      ...headerLines(http2 && http2.headers),
      ...headerLines(http1 && http1.headers),
    ].join("; ");
    const settings = http2 && Array.isArray(http2.settings)
      ? http2.settings
          .map((item) =>
            item && item.name != null && item.value != null ? `${item.name}=${item.value}` : "",
          )
          .filter(Boolean)
          .join(", ")
      : "";
    const region =
      payload && payload.region
        ? `${payload.region}${payload.region_code ? ` (${payload.region_code})` : ""}`
        : "";
    const continent =
      payload && payload.continent
        ? `${payload.continent}${payload.continent_code ? ` (${payload.continent_code})` : ""}`
        : "";

    const internet = [
      ["IP Address", payload ? shown(payload.ip) : "Lookup failed"],
      ["IP Version", payload ? shown(payload.type) : ""],
      ["Reverse Name", hostname],
      ["ASN", asn],
      ["ISP", connection ? shown(connection.isp) : ""],
      ["Organisation", connection ? shown(connection.org) : ""],
      ["Network Domain", connection ? shown(connection.domain) : ""],
      ["Network Name", registration ? registration.name : ""],
      ["Address Block", registration ? registration.cidr : ""],
      ["Allocation Type", registration ? registration.type : ""],
      ["Registry Country", registration ? registration.country : ""],
      ["Network Status", registration ? registration.status : ""],
      ["Abuse Contact", registration ? registration.abuse : ""],
      ["Registered", registration ? registration.registered : ""],
      ["Country", country],
      ["Region", region],
      ["City", payload ? shown(payload.city) : ""],
      ["Postal Code", payload ? shown(payload.postal) : ""],
      ["Continent", continent],
      ["Coordinates", coordinates],
      [
        "In the EU",
        payload && payload.is_eu != null ? yesNo(Boolean(payload.is_eu)) : "",
      ],
      ["Calling Code", payload ? shown(payload.calling_code) : ""],
      ["Capital", payload ? shown(payload.capital) : ""],
      ["Borders", payload ? shown(payload.borders) : ""],
      ["Flag", payload && payload.flag ? shown(payload.flag.emoji) : ""],
      ["Network Time Zone", networkZone],
      ["Network UTC Offset", networkOffset],
      ["Daylight Saving", zone && zone.is_dst != null ? yesNo(Boolean(zone.is_dst)) : ""],
      ["Time Zone Agrees", zoneAgrees],
      ["Proxy", payload && typeof payload.proxy === "boolean" ? yesNo(payload.proxy) : ""],
      ["Link Type", linkType],
      ["Effective Type", link ? shown(link.effectiveType) : ""],
      ["Downlink", downlink],
      ["Downlink Max", link && typeof link.downlinkMax === "number" ? `${link.downlinkMax} Mb/s` : ""],
      ["Round Trip", roundTrip],
      [
        "Data Saver",
        link && link.saveData != null ? yesNo(Boolean(link.saveData)) : "",
      ],
      ["Online", yesNo(navigator.onLine)],
      [
        "Local or Shared Addresses",
        addresses.length ? localAddresses.join(", ") || "None" : "",
      ],
      ["Public Addresses", addresses.length ? publicAddresses.join(", ") || "None" : ""],
      ["Private Names", addresses.length ? privateNames.join(", ") || "None" : ""],
      [
        "Announced Addresses",
        addresses.length ? addresses.join(", ") : "None announced",
      ],
      [
        "WebRTC Local Probe",
        localProbe === null
          ? "Not available"
          : probed.length
            ? probed.join(", ")
            : "None announced",
      ],
      ["Private IP from WebRTC", privateFromProbe],
      ["Public Address Agrees", publicAgrees],
      ["WebRTC Candidate Types", namedIce(ice ? ice.candidateTypes : [], typeNames)],
      ["WebRTC Transport", namedIce(ice ? ice.protocols : [], { udp: "UDP", tcp: "TCP" })],
      ["WebRTC Network", namedIce(ice ? ice.networks : [], networkNames)],
    ];

    const web = [
      ["HTTP Protocol", navigation && "nextHopProtocol" in navigation ? navigation.nextHopProtocol : ""],
      ["JA3", handshake ? shown(handshake.ja3) : ""],
      ["JA3 Hash", handshake ? shown(handshake.ja3_hash) : ""],
      ["JA4", handshake ? shown(handshake.ja4) : "Lookup failed"],
      ["JA4 Raw", handshake ? shown(handshake.ja4_r) : ""],
      ["TLS Version", tls ? shown(tls.negotiated_version) : ""],
      ["TLS Cipher", tls ? shown(tls.negotiated_cipher) : ""],
      ["ALPN", tls ? shown(tls.negotiated_alpn) : ""],
      ["SNI", tls ? shown(tls.sni) : ""],
      ["Cipher Suites", tls ? namedList(tls.cipher_suites) : ""],
      ["TLS Extensions", tls ? namedList(tls.extensions) : ""],
      ["Supported Groups", tls ? namedList(tls.supported_groups) : ""],
      ["Signature Algorithms", tls ? namedList(tls.signature_algorithms) : ""],
      ["Supported Versions", tls ? namedList(tls.supported_versions) : ""],
      [
        "HTTP/2 Fingerprint",
        http2 ? shown(http2.akamai_fingerprint) : handshake ? "Not used" : "",
      ],
      [
        "HTTP/2 Fingerprint Hash",
        http2 ? shown(http2.akamai_fingerprint_hash) : handshake ? "Not used" : "",
      ],
      ["HTTP/2 Settings", settings],
      ["Header Order", [...pseudo, ...headerNames].join(", ")],
      ["Headers", seenHeaders],
    ];

    return { internet, web };
  };

  /**
   * @returns {Promise<{ device: Array<[string, string]>, browser: Array<[string, string]> }>}
   */
  const browserRows = async () => {
    const uaData = navigator.userAgentData;
    /** @type {Record<string, unknown>} */
    let hints = {};
    if (uaData && typeof uaData.getHighEntropyValues === "function") {
      try {
        hints = await uaData.getHighEntropyValues([
          "architecture",
          "bitness",
          "model",
          "platformVersion",
          "uaFullVersion",
          "fullVersionList",
          "wow64",
        ]);
        try {
          Object.assign(hints, await uaData.getHighEntropyValues(["formFactors"]));
        } catch {
          /* Older browsers reject unknown hints. */
        }
      } catch {
        hints = {};
      }
    }

    const brands = /** @type {Array<{brand: string, version: string}>} */ (
      hints.fullVersionList || (uaData && uaData.brands) || []
    );
    const brandList = brands
      .filter((item) => item && item.brand)
      .map((item) => `${item.brand} ${item.version}`)
      .join(", ");
    const primaryBrand = brands.find((item) => {
      if (!item || !item.brand || item.brand === "Chromium") return false;
      return !/not.?a.?brand/i.test(item.brand);
    });
    const agentBrowser = (() => {
      const agent = navigator.userAgent;
      const edge = agent.match(/Edg\/(\S+)/);
      if (edge) return { brand: "Microsoft Edge", version: edge[1] };
      const chrome = agent.match(/Chrome\/(\S+)/);
      if (chrome) return { brand: "Chrome", version: chrome[1] };
      const firefox = agent.match(/Firefox\/(\S+)/);
      if (firefox) return { brand: "Firefox", version: firefox[1] };
      const safari = agent.match(/Version\/(\S+).+Safari\//);
      if (safari) return { brand: "Safari", version: safari[1] };
      return null;
    })();
    const browserName = primaryBrand ? primaryBrand.brand : agentBrowser ? agentBrowser.brand : "";
    const browserVersion = primaryBrand
      ? primaryBrand.version
      : agentBrowser
        ? agentBrowser.version
        : shown(hints.uaFullVersion);

    /** @type {BatteryManager | null} */
    let battery = null;
    if (typeof navigator.getBattery === "function") {
      try {
        battery = await navigator.getBattery();
      } catch {
        battery = null;
      }
    }

    /** @type {{usage?: number, quota?: number} | null} */
    let storage = null;
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      try {
        storage = await navigator.storage.estimate();
      } catch {
        storage = null;
      }
    }

    const permission = async (name) => {
      if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
        return "Not available";
      }
      try {
        const status = await navigator.permissions.query({ name });
        const state = status.state || "";
        return state ? state.charAt(0).toUpperCase() + state.slice(1) : "Not available";
      } catch {
        return "Not available";
      }
    };

    const permissionRows = await Promise.all(
      [
        ["geolocation", "Geolocation Permission"],
        ["camera", "Camera Permission"],
        ["microphone", "Microphone Permission"],
        ["notifications", "Notification Permission"],
        ["clipboard-read", "Clipboard Read Permission"],
        ["clipboard-write", "Clipboard Write Permission"],
        ["persistent-storage", "Persistent Storage Permission"],
        ["midi", "MIDI Permission"],
        ["display-capture", "Display Capture Permission"],
        ["local-fonts", "Local Fonts Permission"],
        ["window-management", "Window Management Permission"],
        ["screen-wake-lock", "Wake Lock Permission"],
        ["accelerometer", "Accelerometer Permission"],
        ["gyroscope", "Gyroscope Permission"],
        ["magnetometer", "Magnetometer Permission"],
        ["nfc", "NFC Permission"],
        ["idle-detection", "Idle Detection Permission"],
        ["storage-access", "Storage Access Permission"],
      ].map(async ([name, label]) => /** @type {[string, string]} */ ([label, await permission(name)])),
    );

    const zone = Intl.DateTimeFormat().resolvedOptions();
    const scheme = media("(prefers-color-scheme: dark)")
      ? "Dark"
      : media("(prefers-color-scheme: light)")
        ? "Light"
        : "No preference";
    const pointer = media("(pointer: fine)")
      ? "Fine"
      : media("(pointer: coarse)")
        ? "Coarse"
        : "None";
    const hover = media("(hover: hover)") ? "Can hover" : "No hover";
    const contrast = media("(prefers-contrast: more)")
      ? "More"
      : media("(prefers-contrast: less)")
        ? "Less"
        : "No preference";
    const range = media("(dynamic-range: high)") ? "High" : "Standard";
    const orientation = screen.orientation
      ? `${screen.orientation.type} (${screen.orientation.angle}°)`
      : "";

    let webglVendor = "";
    let webglRenderer = "";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        webglVendor = debug
          ? shown(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
          : shown(gl.getParameter(gl.VENDOR));
        webglRenderer = debug
          ? shown(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : shown(gl.getParameter(gl.RENDERER));
      }
    } catch {
      webglVendor = "";
      webglRenderer = "";
    }

    let webglVersion = "";
    let webglShading = "";
    let webglTexture = "";
    let webglExtensions = "";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        webglVersion = shown(gl.getParameter(gl.VERSION));
        webglShading = shown(gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        webglTexture = shown(gl.getParameter(gl.MAX_TEXTURE_SIZE));
        webglExtensions = (gl.getSupportedExtensions() || []).join(", ");
      }
    } catch {
      webglVersion = "";
    }

    const canvasFingerprint = await (async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 60;
        const context = canvas.getContext("2d");
        if (!context) return "";
        context.textBaseline = "top";
        context.font = "16px Arial";
        context.fillStyle = "#f60";
        context.fillRect(0, 0, 120, 28);
        context.fillStyle = "#069";
        context.fillText("Browser Interrogator", 2, 2);
        context.strokeStyle = "rgba(120, 180, 80, 0.7)";
        context.beginPath();
        context.arc(80, 40, 12, 0, Math.PI * 2);
        context.stroke();
        return await sha256(canvas.toDataURL());
      } catch {
        return "";
      }
    })();

    const audioFingerprint = await within(
      (async () => {
        if (typeof OfflineAudioContext !== "function") return "";
        const context = new OfflineAudioContext(1, 44100, 44100);
        const oscillator = context.createOscillator();
        oscillator.type = "triangle";
        oscillator.frequency.value = 10000;
        const compressor = context.createDynamicsCompressor();
        oscillator.connect(compressor);
        compressor.connect(context.destination);
        oscillator.start(0);
        const buffer = await context.startRendering();
        const samples = [...buffer.getChannelData(0).slice(4500, 5000)];
        return sha256(samples.join(","));
      })(),
      3000,
    );

    const installedFonts = (() => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return "";
        const sample = "mmmmmmmmmmlli";
        const baselines = ["monospace", "sans-serif", "serif"];
        const widths = {};
        for (const baseline of baselines) {
          context.font = `72px ${baseline}`;
          widths[baseline] = context.measureText(sample).width;
        }
        const found = FONT_CANDIDATES.filter((font) =>
          baselines.some((baseline) => {
            context.font = `72px "${font}", ${baseline}`;
            return context.measureText(sample).width !== widths[baseline];
          }),
        );
        return found.length ? found.join(", ") : "None from the common set";
      } catch {
        return "";
      }
    })();

    const voiceList = await within(
      new Promise((resolve) => {
        if (!window.speechSynthesis) {
          resolve("");
          return;
        }
        const finish = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", finish);
          const voices = window.speechSynthesis.getVoices();
          resolve(
            voices.length
              ? voices.map((voice) => `${voice.name} (${voice.lang})`).join("; ")
              : "None",
          );
        };
        const current = window.speechSynthesis.getVoices();
        if (current.length) {
          resolve(current.map((voice) => `${voice.name} (${voice.lang})`).join("; "));
          return;
        }
        window.speechSynthesis.addEventListener("voiceschanged", finish);
        window.setTimeout(finish, 1200);
      }),
      1500,
    );

    let mediaSummary = "";
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const counts = {};
        for (const device of devices) {
          counts[device.kind] = (counts[device.kind] || 0) + 1;
        }
        const summary = Object.entries(counts)
          .map(([kind, count]) => `${count} ${kind.replaceAll("-", " ")}`)
          .join(", ");
        const labels = devices
          .filter((device) => device.label)
          .map((device) => device.label);
        mediaSummary = labels.length ? `${summary}. ${labels.join(", ")}` : summary || "None";
      } catch {
        mediaSummary = "";
      }
    }

    let gpuText = "";
    if (navigator.gpu && typeof navigator.gpu.requestAdapter === "function") {
      const adapter = await within(navigator.gpu.requestAdapter(), 2000);
      if (adapter) {
        const info =
          adapter.info ||
          (typeof adapter.requestAdapterInfo === "function"
            ? await adapter.requestAdapterInfo()
            : null);
        if (info) {
          gpuText = [info.vendor, info.architecture, info.device, info.description]
            .filter(Boolean)
            .join(", ");
        }
      }
    }

    let keyboardText = "";
    if (navigator.keyboard && typeof navigator.keyboard.getLayoutMap === "function") {
      const layout = await within(navigator.keyboard.getLayoutMap(), 1500);
      if (layout && typeof layout.entries === "function") {
        keyboardText = [...layout.entries()].map(([code, key]) => `${code}=${key}`).join(", ");
      }
    }

    const grantedCount = async (api) => {
      if (!api || typeof api.getDevices !== "function") return "";
      try {
        const devices = await api.getDevices();
        return devices.length ? String(devices.length) : "None granted to this site";
      } catch {
        return "";
      }
    };
    const [usbDevices, serialDevices, hidDevices, bluetoothAvailable, storagePersisted] =
      await Promise.all([
        grantedCount(navigator.usb),
        grantedCount(navigator.serial),
        grantedCount(navigator.hid),
        navigator.bluetooth && typeof navigator.bluetooth.getAvailability === "function"
          ? navigator.bluetooth.getAvailability().then(yesNo).catch(() => "")
          : "",
        navigator.storage && typeof navigator.storage.persisted === "function"
          ? navigator.storage.persisted().then(yesNo).catch(() => "")
          : "",
      ]);

    let databaseNames = "";
    if (window.indexedDB && typeof indexedDB.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        databaseNames = databases.length
          ? databases.map((database) => database.name).filter(Boolean).join(", ")
          : "None";
      } catch {
        databaseNames = "";
      }
    }

    let cacheNames = "";
    if (window.caches && typeof caches.keys === "function") {
      try {
        const names = await caches.keys();
        cacheNames = names.length ? names.join(", ") : "None";
      } catch {
        cacheNames = "";
      }
    }

    const storageKeys = (store) => {
      try {
        if (!store) return "";
        const names = [];
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index);
          if (key) names.push(key);
        }
        return names.length ? names.join(", ") : "None";
      } catch {
        return "Not available";
      }
    };

    const locale = (() => {
      try {
        return new Intl.Locale(navigator.language);
      } catch {
        return null;
      }
    })();
    const gamut = media("(color-gamut: rec2020)")
      ? "Rec. 2020"
      : media("(color-gamut: p3)")
        ? "P3"
        : media("(color-gamut: srgb)")
          ? "sRGB"
          : "";
    const displayMode = ["fullscreen", "standalone", "minimal-ui", "browser"].find((mode) =>
      media(`(display-mode: ${mode})`),
    );
    const pluginNames = [...(navigator.plugins || [])].map((plugin) => plugin.name).join(", ");
    const memory = performance.memory;
    const viewport = window.visualViewport;

    const storageText =
      storage && storage.usage != null && storage.quota != null
        ? `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)}`
        : "";
    const batteryText = battery
      ? `${Math.round(battery.level * 100)}%${battery.charging ? ", charging" : ""}`
      : "";
    const doNotTrack = navigator.doNotTrack;
    const doNotTrackText =
      doNotTrack === "1" ? "On" : doNotTrack === "0" ? "Off" : "Not set";

    const probe = (fn) => {
      try {
        return yesNo(Boolean(fn()));
      } catch {
        return "Not available";
      }
    };

    const navigation = performance.getEntriesByType("navigation")[0];

    const mediaKey = (keySystem, robustness) => {
      if (typeof navigator.requestMediaKeySystemAccess !== "function") return Promise.resolve("");
      const video = { contentType: 'video/mp4; codecs="avc1.42E01E"' };
      const audio = { contentType: 'audio/mp4; codecs="mp4a.40.2"' };
      if (robustness) {
        video.robustness = robustness;
        audio.robustness = robustness;
      }
      const initTypes = keySystem === "com.apple.fps" ? [["sinf"], ["skd"], ["cenc"]] : [["cenc"]];
      const attempt = (async () => {
        for (const initDataTypes of initTypes) {
          try {
            await navigator.requestMediaKeySystemAccess(keySystem, [
              {
                initDataTypes,
                videoCapabilities: [video],
                audioCapabilities: [audio],
              },
            ]);
            return "Yes";
          } catch {
            /* The next init-data type may be the one this browser accepts. */
          }
        }
        return "No";
      })();
      return within(attempt, 2500).then((value) => value || "");
    };

    const [
      widevine,
      widevineHardware,
      playReady,
      fairPlay,
      clearKey,
      platformAuthenticator,
      passkeyAutofill,
      webauthnCapabilities,
      audioOutput,
      h264,
      emojiFingerprint,
      topicsText,
      cookieLabel,
    ] = await Promise.all([
      mediaKey("com.widevine.alpha", ""),
      mediaKey("com.widevine.alpha", "HW_SECURE_ALL"),
      mediaKey("com.microsoft.playready", ""),
      mediaKey("com.apple.fps", ""),
      mediaKey("org.w3.clearkey", ""),
      (async () => {
        if (
          typeof PublicKeyCredential === "undefined" ||
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
        ) {
          return "";
        }
        try {
          const available = await within(
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
            2000,
          );
          return available == null ? "" : yesNo(Boolean(available));
        } catch {
          return "";
        }
      })(),
      (async () => {
        if (
          typeof PublicKeyCredential === "undefined" ||
          typeof PublicKeyCredential.isConditionalMediationAvailable !== "function"
        ) {
          return "";
        }
        try {
          const available = await within(PublicKeyCredential.isConditionalMediationAvailable(), 2000);
          return available == null ? "" : yesNo(Boolean(available));
        } catch {
          return "";
        }
      })(),
      (async () => {
        if (
          typeof PublicKeyCredential === "undefined" ||
          typeof PublicKeyCredential.getClientCapabilities !== "function"
        ) {
          return "";
        }
        try {
          const caps = await within(PublicKeyCredential.getClientCapabilities(), 2000);
          if (!caps) return "";
          return Object.entries(caps)
            .map(([name, on]) => `${name}: ${on ? "yes" : "no"}`)
            .join(", ");
        } catch {
          return "";
        }
      })(),
      (async () => {
        if (typeof AudioContext !== "function") return { rate: "", channels: "", latency: "" };
        /** @type {AudioContext | null} */
        let context = null;
        try {
          context = new AudioContext();
          return {
            rate: context.sampleRate ? `${context.sampleRate} Hz` : "",
            channels:
              context.destination && context.destination.maxChannelCount
                ? String(context.destination.maxChannelCount)
                : "",
            latency:
              typeof context.baseLatency === "number"
                ? `${Math.round(context.baseLatency * 1000)} ms`
                : "",
          };
        } catch {
          return { rate: "", channels: "", latency: "" };
        } finally {
          if (context) context.close().catch(() => {});
        }
      })(),
      (async () => {
        if (!navigator.mediaCapabilities || typeof navigator.mediaCapabilities.decodingInfo !== "function") {
          return "";
        }
        try {
          const info = await within(
            navigator.mediaCapabilities.decodingInfo({
              type: "file",
              video: {
                contentType: 'video/mp4; codecs="avc1.640028"',
                width: 1920,
                height: 1080,
                bitrate: 8000000,
                framerate: 30,
              },
            }),
            2000,
          );
          if (!info) return "";
          if (!info.supported) return "Not supported";
          return ["Supported", info.smooth ? "smooth" : "not smooth", info.powerEfficient ? "hardware" : "software"].join(", ");
        } catch {
          return "";
        }
      })(),
      (async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 80;
          canvas.height = 32;
          const context = canvas.getContext("2d");
          if (!context) return "";
          context.font = "24px serif";
          context.fillText("😀👍🔒", 0, 24);
          return await sha256(canvas.toDataURL());
        } catch {
          return "";
        }
      })(),
      (async () => {
        if (typeof document.browsingTopics !== "function") return "";
        try {
          const topics = await within(document.browsingTopics(), 2000);
          if (!topics) return "";
          if (!topics.length) return "None";
          return topics.map((topic) => String(topic.topic)).join(", ");
        } catch {
          return "";
        }
      })(),
      (async () => {
        const label = navigator.cookieDeprecationLabel;
        if (!label || typeof label.getValue !== "function") return "";
        try {
          const value = await within(label.getValue(), 2000);
          return value == null ? "" : String(value);
        } catch {
          return "";
        }
      })(),
    ]);

    const codecList = (kind) => {
      if (!window.RTCRtpSender || typeof RTCRtpSender.getCapabilities !== "function") return "";
      const caps = RTCRtpSender.getCapabilities(kind);
      if (!caps || !Array.isArray(caps.codecs)) return "";
      const names = [];
      for (const codec of caps.codecs) {
        if (codec.mimeType && !names.includes(codec.mimeType)) names.push(codec.mimeType);
      }
      return names.join(", ");
    };
    const videoHdr = media("(video-dynamic-range: high)")
      ? "High"
      : media("(video-dynamic-range: standard)")
        ? "Standard"
        : "";
    const displayUpdate = media("(update: none)")
      ? "None"
      : media("(update: slow)")
        ? "Slow"
        : media("(update: fast)")
          ? "Fast"
          : "";
    const gamepads = typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()].filter(Boolean) : null;
    const gamepadText = gamepads === null
      ? ""
      : gamepads.length
        ? gamepads.map((pad) => pad.id).join("; ")
        : "None connected";
    const posture = navigator.devicePosture && navigator.devicePosture.type
      ? String(navigator.devicePosture.type)
      : "";
    let weekStarts = "";
    try {
      const info = locale && (typeof locale.getWeekInfo === "function" ? locale.getWeekInfo() : locale.weekInfo);
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      if (info && info.firstDay >= 1 && info.firstDay <= 7) weekStarts = days[info.firstDay - 1];
    } catch {
      weekStarts = "";
    }
    const sampleDate = new Date(Date.UTC(2026, 0, 2, 15, 4));
    const dateFormat = sampleDate.toLocaleString(undefined, { timeZone: zone.timeZone || "UTC" });
    const numberFormat = (1234567.89).toLocaleString();
    const mimeNames = [...(navigator.mimeTypes || [])].map((item) => item.type).filter(Boolean).join(", ");

    const device = [
      ["Mobile", uaData ? yesNo(Boolean(uaData.mobile)) : ""],
      ["Form Factors", Array.isArray(hints.formFactors) ? hints.formFactors.join(", ") : ""],
      ["Platform", hints.platform || (uaData && uaData.platform) || navigator.platform],
      ["Platform Version", hints.platformVersion],
      ["Operating System", [hints.platform || navigator.platform, hints.platformVersion].filter(Boolean).join(" ")],
      ["Architecture", hints.architecture],
      ["Bitness", hints.bitness],
      ["64-bit on 32-bit Windows", hints.wow64 == null ? "" : yesNo(Boolean(hints.wow64))],
      ["Device Model", hints.model],
      ["Time Zone", zone.timeZone],
      ["UTC Offset", utcOffset(-new Date().getTimezoneOffset())],
      ["Screen Size", `${screen.width} × ${screen.height}`],
      ["Available Screen", `${screen.availWidth} × ${screen.availHeight}`],
      ["Screen Origin", `${screen.availLeft}, ${screen.availTop}`],
      ["Pixel Ratio", window.devicePixelRatio],
      ["Colour Depth", `${screen.colorDepth}-bit`],
      ["Pixel Depth", `${screen.pixelDepth}-bit`],
      ["Colour Gamut", gamut],
      ["Extended Display", screen.isExtended == null ? "" : yesNo(Boolean(screen.isExtended))],
      ["Orientation", orientation],
      ["Touch Points", navigator.maxTouchPoints],
      ["Processor Cores", navigator.hardwareConcurrency],
      ["Device Memory", navigator.deviceMemory ? `${navigator.deviceMemory} GB` : ""],
      ["Battery", batteryText],
      ["Audio Sample Rate", audioOutput.rate],
      ["Audio Channels", audioOutput.channels],
      ["Audio Latency", audioOutput.latency],
      ["Video HDR", videoHdr],
      ["Display Update", displayUpdate],
      ["H.264 Decode", h264],
      ["Widevine", widevine],
      ["Widevine Hardware", widevineHardware],
      ["PlayReady", playReady],
      ["FairPlay", fairPlay],
      ["ClearKey", clearKey],
      ["Platform Authenticator", platformAuthenticator],
      ["Passkey Autofill", passkeyAutofill],
      ["WebAuthn Capabilities", webauthnCapabilities],
      ["Gamepads", gamepadText],
      ["Device Posture", posture],
      ["Pointer", pointer],
      ["Any Pointer", media("(any-pointer: fine)") ? "Fine" : media("(any-pointer: coarse)") ? "Coarse" : "None"],
      ["Hover", hover],
      ["Any Hover", yesNo(Boolean(media("(any-hover: hover)")))],
      ["Installed Fonts", installedFonts],
      ["Keyboard Layout", keyboardText],
      ["WebGL Vendor", webglVendor],
      ["WebGL Renderer", webglRenderer],
      ["WebGPU", gpuText],
      ["Media Devices", mediaSummary],
      ["USB Devices", usbDevices],
      ["Serial Devices", serialDevices],
      ["HID Devices", hidDevices],
      ["Bluetooth Available", bluetoothAvailable],
    ];

    const browser = [
      ["User Agent", navigator.userAgent],
      ["Browser", browserName],
      ["Browser Version", browserVersion],
      ["Browser Brands", brandList],
      ["Vendor", navigator.vendor],
      ["Product", navigator.product],
      ["Preferred Language", navigator.language],
      ["Language Region", locale ? locale.region : ""],
      ["Languages", (navigator.languages || []).join(", ")],
      ["Calendar", zone.calendar],
      ["Hour Cycle", zone.hourCycle],
      ["Numbering System", zone.numberingSystem],
      ["Locale", zone.locale],
      ["Date Format", dateFormat],
      ["Number Format", numberFormat],
      ["Week Starts", weekStarts],
      ["Window Size", `${window.innerWidth} × ${window.innerHeight}`],
      ["Outer Window", `${window.outerWidth} × ${window.outerHeight}`],
      ["Window Position", `${window.screenX}, ${window.screenY}`],
      ["Visual Viewport", viewport ? `${Math.round(viewport.width)} × ${Math.round(viewport.height)} at ${viewport.scale}×` : ""],
      ["JS Heap Limit", memory ? formatBytes(memory.jsHeapSizeLimit) : ""],
      ["Colour Scheme", scheme],
      ["Reduced Motion", yesNo(Boolean(media("(prefers-reduced-motion: reduce)")))],
      ["Reduced Data", yesNo(Boolean(media("(prefers-reduced-data: reduce)")))],
      ["Contrast", contrast],
      ["Reduced Transparency", yesNo(Boolean(media("(prefers-reduced-transparency: reduce)")))],
      ["Forced Colours", yesNo(Boolean(media("(forced-colors: active)")))],
      ["Inverted Colours", yesNo(Boolean(media("(inverted-colors: inverted)")))],
      ["Dynamic Range", range],
      ["Display Mode", displayMode || ""],
      ["Cookies Enabled", yesNo(navigator.cookieEnabled)],
      ["Readable Cookies", document.cookie || "None"],
      ["Do Not Track", doNotTrackText],
      ["Global Privacy Control", yesNo(navigator.globalPrivacyControl)],
      ["Cookie Deprecation Label", cookieLabel],
      ["Topics", topicsText],
      ["Character Set", document.characterSet || ""],
      ["Origin Agent Cluster", "originAgentCluster" in window ? yesNo(Boolean(window.originAgentCluster)) : ""],
      ["Secure Context", yesNo(window.isSecureContext)],
      ["Cross-Origin Isolated", yesNo(window.crossOriginIsolated)],
      ["Shared Memory", yesNo(typeof SharedArrayBuffer === "function")],
      ["Local Storage", probe(() => Boolean(window.localStorage))],
      ["Local Storage Keys", storageKeys(window.localStorage)],
      ["Session Storage", probe(() => Boolean(window.sessionStorage))],
      ["Session Storage Keys", storageKeys(window.sessionStorage)],
      ["IndexedDB", probe(() => Boolean(window.indexedDB))],
      ["Databases", databaseNames],
      ["Cache Storage", cacheNames],
      ["Storage", storageText],
      ["Persistent Storage", storagePersisted],
      ["Service Worker", yesNo(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller))],
      ["Speech Voices", voiceList || ""],
      ["Canvas Fingerprint", canvasFingerprint],
      ["Emoji Fingerprint", emojiFingerprint],
      ["Audio Fingerprint", audioFingerprint || ""],
      ["WebGL Version", webglVersion],
      ["WebGL Shading Language", webglShading],
      ["WebGL Max Texture", webglTexture],
      ["WebGL Extensions", webglExtensions],
      ["Plugins", pluginNames],
      ["MIME Types", mimeNames],
      ["Audio Codecs", codecList("audio")],
      ["Video Codecs", codecList("video")],
      ["PDF Viewer", yesNo(navigator.pdfViewerEnabled)],
      ["Automated Browser", yesNo(navigator.webdriver)],
      ["History Length", history.length],
      ["Navigation Type", navigation ? navigation.type : ""],
      ["Referrer", document.referrer || "None"],
      ...permissionRows,
    ];

    return { device, browser };
  };

  let generation = 0;

  const fill = async () => {
    const internet = document.getElementById("show-me-internet");
    const web = document.getElementById("show-me-web");
    const device = document.getElementById("show-me-device");
    const browser = document.getElementById("show-me-browser");
    if (
      !(internet instanceof HTMLTableElement) ||
      !(web instanceof HTMLTableElement) ||
      !(device instanceof HTMLTableElement) ||
      !(browser instanceof HTMLTableElement)
    ) {
      return;
    }

    const current = ++generation;
    render(internet, [["IP Address", "Looking up…"]]);
    render(web, [["HTTP Protocol", "Looking up…"]]);
    render(device, [["Platform", "Reading…"]]);
    render(browser, [["User Agent", "Reading…"]]);

    const [addressResult, announcedResult, browserResult, handshakeResult, localProbeResult] =
      await Promise.allSettled([
        lookupAddress(),
        announcedAddresses(),
        browserRows(),
        lookupHandshake(),
        localIpProbe(),
      ]);
    if (current !== generation) return;
    if (!document.body.contains(internet)) return;

    const payload = addressResult.status === "fulfilled" ? addressResult.value : null;
    const ice = announcedResult.status === "fulfilled" ? announcedResult.value : null;
    const ip = payload && typeof payload.ip === "string" ? payload.ip : "";
    const [hostResult, registrationResult] = ip
      ? await Promise.allSettled([lookupHostname(ip), lookupRegistration(ip)])
      : [];
    if (current !== generation) return;
    if (!document.body.contains(internet)) return;
    const hostname = hostResult && hostResult.status === "fulfilled" ? hostResult.value : "";
    const registration =
      registrationResult && registrationResult.status === "fulfilled"
        ? registrationResult.value
        : null;
    const handshake =
      handshakeResult.status === "fulfilled" ? handshakeResult.value : null;
    const localProbe =
      localProbeResult.status === "fulfilled" ? localProbeResult.value : null;
    const rows = connectionRows(payload, ice, hostname, registration, handshake, localProbe);
    render(internet, rows.internet);
    render(web, rows.web);
    if (browserResult.status === "fulfilled") {
      render(device, browserResult.value.device);
      render(browser, browserResult.value.browser);
    }
  };

  onPageRender(() => {
    fill();
  });
})();
