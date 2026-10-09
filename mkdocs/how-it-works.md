# How it Works

The tables on [Interrogate Me](interrogate-me.md) are filled when that page loads.
Together they are what a page can read, or look up, without installing
anything or asking for permission. A normal website can collect the same
facts on every visit. There is no program, no browser extension, and no
account.

The address lookup, the reverse name, and the registration record leave
the browser. So does one more request, to a public handshake reader at
[kittens.sh](https://kittens.sh/). That service finishes the TLS connection
itself and sends back the JA3 and JA4 fingerprints, the cipher list, and
the header order. The script in this page cannot see the handshake that
delivered the page, because that handshake is already finished. This site
does not run the reader. If it is down, those rows say the lookup failed.

A STUN packet also leaves the browser, so the page can see which addresses
this browser announces to a peer. The older private-address probe does not
use a server. Everything else is read locally, and the canvas and audio
fingerprints stay in this browser.

A missing value is shown as **Not available**. One lookup that fails does
not blank the rest of the table.

## Requests That Leave the Browser

Five contacts can leave the machine. Four are HTTPS fetches. One is a STUN
packet. None of them ask for a permission prompt.

### Address Lookup

The page fetches `https://ipwho.is/`. The response is the public address
that made that request, which is the same address a site sees for the page
view. That service limits how often one address may ask. When it refuses,
the page asks `https://ipapi.co/json/` and then
`https://freeipapi.com/api/json/`, and fills the same rows from whichever
one answers.

From that JSON the table takes the address and IP version, the ASN, ISP,
organisation, and network domain, and the country, region, city, postal
code, continent, and coordinates. It also takes whether the country is in
the EU, the calling code, capital, bordering countries, and flag, plus the
network time zone, UTC offset, and daylight-saving flag. A fallback that
omits one of those leaves the row as **Not available**. The flag, when the
response has no emoji of its own, is the emoji for the country code.

The first lookup has no VPN, proxy, Tor, or hosting flag. One fallback can
include a proxy flag, and that value is shown only when the response
contains it. The page does not invent one. The honest comparison is
**Time Zone Agrees**: the browser time zone from `Intl.DateTimeFormat`,
set beside the time zone of the network. A mismatch can mean a VPN, a
tunnel, or a clock set for somewhere else. It is not proof of any of those.

### Reverse Name

When the address lookup returns an IP, the page asks Cloudflare for the
pointer record:

`https://cloudflare-dns.com/dns-query?name=…&type=PTR`

The request sends `Accept: application/dns-json`. An IPv4 address is
reversed by octet and given the suffix `.in-addr.arpa`. An IPv6 address is
expanded, split into nibbles, reversed, and given the suffix `.ip6.arpa`.
A zone id after `%` is dropped before either name is built. If the answer
has no PTR, the row says **No reverse name**.

### Registration Record

The same IP is sent to `https://rdap.org/ip/` plus the address. Colons in
an IPv6 address are left as they are. Encoding them makes the registry
reject the request. `rdap.org` redirects to the registry that holds the
block, such as RIPE or ARIN, and the browser follows that redirect.

The table uses the network name, the CIDR prefix, the allocation type, the
registry country, the status list, the registration date, and any abuse
email on an entity whose role is `abuse`.

### TLS Handshake

JA3 and JA4 are hashes of the ClientHello: the ciphers, extensions, and
groups this browser offered when it opened the connection. A page cannot
read that message. The handshake is finished before any script runs.

The page therefore opens a second connection to
`https://kittens.sh/api/all`. That server terminates TLS itself and returns
what it saw on *that* connection, which is this browser's fingerprint.
The response includes:

-   The JA3 string and its MD5 hash. Chrome shuffles extension order, so this
    hash moves between launches.
-   JA4, which sorts those fields, and the raw JA4 string with the hashes
    expanded.
-   The negotiated TLS version, cipher, ALPN protocol, and server name.
-   The cipher suites, extensions, groups, signature algorithms, and versions
    from the ClientHello, including GREASE values marked as such.
-   When the browser used HTTP/2, the Akamai fingerprint, its hash, the
    SETTINGS frame, and the header names in arrival order, pseudo-headers
    first. The **Headers** row also shows the values, which is the request
    a server received on that connection.

This site does not operate kittens.sh. The service allows any page to read
the JSON. If the request fails, **JA4** says **Lookup failed** and the
other handshake rows say **Not available**.

### STUN

The announced-address check opens `RTCPeerConnection` with one ICE server,
`stun:stun.l.google.com:19302`, and a data channel. As candidates arrive,
the page records `candidate.address` and also parses the candidate line.
Older browsers put the address only in that line, and never on the
`address` property. When gathering finishes, or after 2.5 seconds, the
page also scans the session description for candidate lines. Before the
connection closes it reads `getStats` for the candidate type (host, server
reflexive, or relay), the transport (UDP or TCP), and, when the browser
still reports it, the network type such as Wi-Fi or Ethernet.

Those addresses are split into local or shared (private IPv4, link-local
and unique-local IPv6), public, and private names ending in `.local`.
**Public Address Agrees** compares a public announced address with the
address from the IP lookup. A mismatch is the honest sign that the two
paths left the machine through different networks. The page does not turn
that into a VPN flag.

## WebRTC Local Probe

Some older browsers put the LAN address in a host candidate even when no
STUN server was configured. The page repeats that check on its own.

It opens a peer connection with `iceServers` set to an empty list, creates
a data channel, and waits two seconds. It reads the same candidate text,
including a search for dotted IPv4 addresses, and the session description.

**WebRTC Local Probe** lists every address that produced. **Private IP
from WebRTC** lists every private address either check returned, from the
STUN candidates and from this probe. If the browser includes the LAN
address, that address is shown. A page opened from this computer, on a
local address, often still receives it. Many current browsers hide that
address from a public site and put a random `.local` name in its place.
When that is all that comes back, the row says the browser replaced it
with a private name.

## What Stays in the Browser

The device table and the browser table are one pass over the APIs a page
is allowed to call without a prompt. A missing API, or a value the browser
refuses to give, becomes **Not available**. The row stays, so the refusal
is visible.

### Browser and Device

`navigator.userAgentData.getHighEntropyValues` is asked for architecture,
bitness, model, platform version, the full version, the full brand list,
and whether 64-bit Windows is running on a 32-bit build. Form factors are
requested in a second call. An unknown hint can reject the whole batch, and
a separate call keeps the first result.

The browser name is the brand that is neither `Chromium` nor the GREASE
`Not.A.Brand` entry. If the brand list has neither, the name and version
are parsed from the user-agent string. Platform, vendor, product, languages,
and `Intl.Locale` supply the language region. `Intl.DateTimeFormat` supplies
the time zone, calendar, hour cycle, and numbering system. A fixed date
and the number `1234567.89` are formatted with the browser locale, and the
week start comes from `Intl.Locale` where the browser provides it.

Screen and window size, screen origin, window position, the visual
viewport, pixel ratio, colour depth, pixel depth, colour gamut, extended
display, orientation, touch points, processor cores, and device memory come
from `screen`, `window`, and `navigator`. The JS heap limit is read from
`performance.memory` where that object exists. Battery level and charging
state come from `navigator.getBattery` where the browser still allows it.
An `AudioContext` supplies the sample rate, the maximum channel count, and
the output latency, then it is closed. `mediaCapabilities.decodingInfo`
reports whether H.264 playback is supported, smooth, and hardware-backed.
`requestMediaKeySystemAccess` checks Widevine, PlayReady, FairPlay, and
ClearKey, including a hardware Widevine level. That call does not play
media and does not prompt. `PublicKeyCredential` reports whether a platform
authenticator (Touch ID, Windows Hello, or the equivalent) is present, and
whether passkey autofill is available. Connected gamepads are listed only
when one is already attached.

Media queries supply the colour scheme, reduced motion, reduced data,
contrast, reduced transparency, forced colours, inverted colours, dynamic
range, video dynamic range, display update speed, pointer, hover, and
display mode.

### Link and Protocol

`navigator.connection` (and the older `mozConnection` and
`webkitConnection` names) supplies link type, effective type, downlink,
maximum downlink, round-trip time, and data saver. Many desktop browsers
omit link type and maximum downlink. The HTTP protocol row is
`nextHopProtocol` on the navigation timing entry, such as `h2` or `h3`.
That is the protocol of the connection, as the browser reports it. It is
not the header order, and it is not a TLS fingerprint.

### Graphics, Fonts, and Sound

WebGL is opened twice. The first context asks for
`WEBGL_debug_renderer_info`, which is the real GPU vendor and renderer
rather than the generic string some browsers return. The second context
records the WebGL version, shading language, maximum texture size, and the
extension list. WebGPU, where it exists, asks for an adapter and reads the
vendor, architecture, device, and description. That request gives up after
two seconds.

Installed fonts are not enumerable. The page measures a sample string in a
fixed list of common family names, drawn beside `monospace`, `sans-serif`,
and `serif`. A width that differs from the generic face means that family
is present. Families outside the list are invisible to the page.

Speech synthesis voices are read immediately, or on `voiceschanged`, and
the wait is capped at about 1.5 seconds.

The canvas fingerprint draws a small picture, reads `toDataURL`, and hashes
it with SHA-256 in `crypto.subtle`. The audio fingerprint renders a short
offline buffer through a triangle oscillator and a dynamics compressor, then
hashes a slice of the samples. A second canvas draws three emoji and
hashes that picture the same way. Emoji glyphs differ by operating system.
Both hashes are computed in the page. They are not uploaded. The audio
render gives up after three seconds.

`RTCRtpSender.getCapabilities` lists the audio and video codecs this
browser will send.

### Storage, Cookies, and Permissions

The page reads whether cookies are enabled, and the cookie string for this
origin. It lists local and session storage keys, IndexedDB database names,
Cache Storage names, the storage estimate, whether storage is persistent,
and whether a service worker is controlling the page. It does not print
stored values.

`document.referrer`, `history.length`, and the navigation type describe how
this visit arrived. Do Not Track and Global Privacy Control are read from
the navigator flags. Secure context, cross-origin isolation, and
`SharedArrayBuffer` are reported as yes or no.

`navigator.permissions.query` is called for geolocation, camera,
microphone, notifications, clipboard read and write, persistent storage,
MIDI, display capture, local fonts, window management, wake lock, motion
sensors, NFC, idle detection, and storage access. That returns a state such
as **Prompt**, **Granted**, or **Denied**. It does not open a dialog, and
it does not read a location, a camera, or a microphone. Where the browser
has no such permission, the row says **Not available**.

The page also reads the character set, whether this origin is in its own
agent cluster, the cookie-deprecation label Chrome sometimes exposes, and
the Topics API when the browser still has it. An empty topic list is
**None**. The API is not asked to invent interests.

Media devices are counted with `enumerateDevices`. Labels stay hidden until
a site has been granted the matching permission. USB, serial, and HID
report only devices this origin was already allowed to use.
`navigator.bluetooth.getAvailability` reports whether a radio is present,
not a list of nearby devices. `navigator.keyboard.getLayoutMap` is tried
and abandoned if the browser requires a key press first.

Plugins and the built-in PDF viewer are listed from `navigator`.
`navigator.webdriver` is the automated-browser flag.

## What This Page Cannot See

The handshake reader describes a second connection, opened so the
fingerprint can be read. It is not a copy of the handshake that delivered
this page. A script never receives that first ClientHello.

The page also does not call `geolocation.getCurrentPosition`,
`getUserMedia`, or `getDisplayMedia`. Those would prompt. The coordinates
in the internet connection table are the IP lookup's place for the network, not a
GPS fix.

It cannot list every font, every file, or the contents of another site's
storage. It cannot see passwords, form history, or bookmarks.

## How the Tables Are Filled

On load, five jobs start together: the address lookup, the STUN gathering,
the local WebRTC probe, the handshake fetch, and the browser reads. When
the address comes back, the reverse name and the registration record start
together. If you leave the page and come back before a slow answer arrives,
that late answer is dropped.
