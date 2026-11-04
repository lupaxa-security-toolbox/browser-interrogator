/**
 * Connection facts for Browser Interrogator.
 * Returns the address, registry record, and TLS summary of this request.
 * The response is not stored.
 */

const CONTINENTS = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
  T1: "Tor",
};

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
};

/**
 * @param {string} ip
 * @returns {boolean}
 */
const isIp = (ip) => {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return (
      parts.length === 4 &&
      parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    );
  }
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
};

/**
 * @param {string} ip
 * @returns {string}
 */
const reverseDnsName = (ip) => {
  if (ip.includes(".")) {
    return `${ip.split(".").reverse().join(".")}.in-addr.arpa`;
  }
  const halves = ip.split("::");
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
 * @returns {Promise<string>}
 */
const reverseName = async (ip) => {
  const name = reverseDnsName(ip);
  if (!name) return "";
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=PTR`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return "";
    const payload = await response.json();
    const answer = (payload.Answer || []).find((item) => item.type === 12);
    return answer && answer.data ? String(answer.data).replace(/\.$/, "") : "No reverse name";
  } catch {
    return "";
  }
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
const registration = async (ip) => {
  try {
    const response = await fetch(`https://rdap.org/ip/${ip}`, {
      headers: {
        Accept: "application/rdap+json",
        "User-Agent": "BrowserInterrogator/0.0.0 (+https://browserinterrogator.com)",
      },
      signal: AbortSignal.timeout(5000),
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
    const registered = (payload.events || []).find((event) => event.eventAction === "registration");
    return {
      name: payload.name || "",
      cidr,
      type: payload.type || "",
      country: payload.country || "",
      status: Array.isArray(payload.status) ? payload.status.join(", ") : "",
      abuse: emails.join(", "),
      registered: registered && registered.eventDate ? String(registered.eventDate) : "",
    };
  } catch {
    return null;
  }
};

/**
 * @param {string} code
 * @returns {string}
 */
const countryName = (code) => {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || "";
  } catch {
    return "";
  }
};

export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: HEADERS });
    }
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: HEADERS,
      });
    }

    const cf = request.cf || {};
    const headerIp = request.headers.get("CF-Connecting-IP") || "";
    const ip = isIp(headerIp) ? headerIp : "";
    const countryCode = typeof cf.country === "string" ? cf.country : "";
    const continentCode = typeof cf.continent === "string" ? cf.continent : "";
    const [reverse, record] = ip
      ? await Promise.all([reverseName(ip), registration(ip)])
      : ["", null];
    const headers = [];
    for (const [name, value] of request.headers) {
      headers.push([name, value]);
    }
    const certificate = cf.tlsClientAuth;
    const clientCertificate =
      certificate && certificate.certPresented === "1"
        ? [certificate.certSubjectDN, certificate.certIssuerDN, certificate.certSerial]
            .filter(Boolean)
            .join("; ")
        : certificate
          ? "None"
          : "";
    const delivery =
      cf.edgeL4 && typeof cf.edgeL4.deliveryRate === "number" ? cf.edgeL4.deliveryRate : null;

    const body = {
      ip,
      version: ip ? (ip.includes(":") ? "IPv6" : "IPv4") : "",
      asn: cf.asn == null ? "" : String(cf.asn),
      organization: cf.asOrganization || "",
      country_code: countryCode,
      country: countryName(countryCode),
      region: cf.region || "",
      region_code: cf.regionCode || "",
      city: cf.city || "",
      postal_code: cf.postalCode || "",
      metro_code: cf.metroCode || "",
      continent_code: continentCode,
      continent: CONTINENTS[continentCode] || "",
      latitude: cf.latitude || "",
      longitude: cf.longitude || "",
      timezone: cf.timezone || "",
      is_eu: cf.isEUCountry === "1" || cf.isEUCountry === true,
      colo: cf.colo || "",
      http_protocol: cf.httpProtocol || "",
      tls_version: cf.tlsVersion || "",
      tls_cipher: cf.tlsCipher || "",
      client_tcp_rtt: typeof cf.clientTcpRtt === "number" ? cf.clientTcpRtt : null,
      client_quic_rtt: typeof cf.clientQuicRtt === "number" ? cf.clientQuicRtt : null,
      cipher_list_hash: cf.tlsClientCiphersSha1 || "",
      extension_list_hash: cf.tlsClientExtensionsSha1 || "",
      extension_list_hash_le: cf.tlsClientExtensionsSha1Le || "",
      client_hello_length: cf.tlsClientHelloLength || "",
      client_random: cf.tlsClientRandom || "",
      delivery_rate: delivery,
      request_priority: cf.requestPriority || "",
      accept_encoding: cf.clientAcceptEncoding || "",
      client_certificate: clientCertificate,
      headers,
      reverse_name: reverse,
      registration: record,
    };

    return new Response(JSON.stringify(body), { headers: HEADERS });
  },
};
