---
hide:
  - navigation
  - toc
title: Privacy Policy
---

<!-- markdownlint-disable-file MD001 -->

<div class="grid cards legal-notice" markdown>

-   :material-shield-lock-outline:{ .lg .middle } **Privacy Policy**

    ### Who We Are

    The Lupaxa Project is an informal collective, not a company. For this website, the collective is the controller. That means it decides why the lookups, analytics, and language tools described below are used.

    Privacy questions go to the <a class="legal-mail" href="mailto:compliance@thelupaxaproject.org">Lupaxa Compliance Team</a> Please use that address rather than a public GitHub issue, so the request is not posted in
    public.

    ### What This Notice Covers

    This notice covers browserinterrogator.com. The site shows what a page can read about the browser and the connection that opened it. It does not ask you to create an account.

    GitHub, Ko-fi, and the lookup services named below are separate sites. Their own notices apply once a request reaches them.

    This site is written for people who want to see what a browser gives away. It is not aimed at children.

    ### Hosting

    The site is published with GitHub Pages. Opening a page sends that request, including the IP address, to GitHub. GitHub is in the United States. This site does not keep its own server log of visits.

    <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub privacy statement</a>

    ### The Interrogation

    Opening [Interrogate Me](../interrogate-me.md) fills the tables on that page. That is the request. Most rows are read in the browser and shown there. This site does not keep a copy of the table, and it does not make
    an account from it.

    The on-device rows include the user agent, languages, screen, time zone, the names of local storage and session storage keys, and the canvas and audio fingerprints. The page also shows cookies this site can read,
    including their values. Key names are shown without the values stored under them. None of that list is sent to a server run for this site.

    A few lookups leave the browser, because a script cannot see those facts on its own. [How it Works](../how-it-works.md) names each one.

    The address lookup goes to a Cloudflare Worker run for this site. The Worker reads the address and the connection facts Cloudflare attached to the request, asks Cloudflare for the reverse name, and asks rdap.org for
    the registration record. It sends the answer back and does not store it. Cloudflare receives that request, including the IP address. Cloudflare may process it outside the United Kingdom, including in the United
    States.

    <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare privacy policy</a>

    If the Worker does not answer, the page asks ipwho.is, then ipapi.co, then freeipapi.com. The reverse name then goes to Cloudflare's DNS service, and the registration record goes to rdap.org, which redirects to the
    registry for that address. This site does not run those services and does not control how long they keep a request.

    The handshake lookup goes to a public reader at kittens.sh. That service finishes its own TLS connection and returns the JA3 and JA4 fingerprints, the cipher list, and the header order for that connection. This site
    does not run the reader and does not keep a copy of the reply.

    A STUN packet goes to stun.l.google.com so the page can list addresses this browser announces to a peer. Google operates that server. Google is in the United States. The older private-address probe does not use a
    server.

    The lawful basis is legitimate interests: showing the facts that page exists to show, on the visit where you opened it.

    ### What the Site Stores on Your Device

    If you choose a language other than English, the site stores that choice in local storage under the name lupaxa-lang. It also stores a cache of translated phrases under lupaxa-lang-strings, so the next page can open
    in the same language. On Interrogate Me that cache can include table values that were translated. Dismissing the English-language note is stored for that browser session only, under lupaxa-lang-fallback-dismissed.

    Turning an analytics tool off stores that choice in local storage. Counter uses the name <span translate="no">lupaxa-counter</span>. Cloudflare uses the name <span translate="no">lupaxa-cloudflare</span>. The value
    in each case is off. Removing the entry turns that tool back on from the next page.

    These values stay on your device. The site reads them to remember the choice you made. The lawful basis is legitimate interests: showing later pages in the language you picked, and honouring a choice to skip a
    counter, without asking again. You can remove them in your browser. The interrogation page does not write its table into storage.

    The site does not use these values to recognise you on any other website.

    ### Analytics

    Every page loads Counter and Cloudflare Web Analytics, unless that tool has been turned off in this browser. They count visits so the collective can see that the site is used and which pages are opened. They are
    not advertising tools. The site does not sell a profile of you, and it does not make automated decisions about you.

    The lawful basis is legitimate interests. The counts are aggregated, and the site has no accounts to attach them to.

    Counter publishes that its script turns a visit into aggregated counts: device type, browser, operating system, language, screen size, referring site, page, time, and a country derived from the IP address. It says
    those counts are stored with Linode in Frankfurt, Germany, that it does not keep a separate record of each visit in its main statistics, and that the shorter-period counts are deleted as time passes. It also says
    daily aggregates are kept. Germany is in the European Economic Area, which the United Kingdom treats as adequate for these transfers. Counter's own notice says its content network may set a cookie when the script is
    loaded. This site does not set that cookie itself.

    <a href="https://counter.dev/pages/privacy.html" target="_blank" rel="noopener noreferrer">Counter's privacy notice</a>

    This button applies to this browser only. Clicking it turns Counter off. The choice is stored in local storage under the name <span translate="no">lupaxa-counter</span> with the value off, and the Counter script is
    not loaded from the next page. Clicking again removes that entry, and counting resumes from the next page. A visit already sent on this page stays sent.

    <button type="button" class="md-button lupaxa-button" data-analytics-choice data-analytics-key="lupaxa-counter" data-analytics-name="Counter" aria-pressed="false">Don't count my visits with Counter</button>

    Cloudflare Web Analytics publishes that its beacon does not use cookies, local storage, or session storage, and that it does not build a fingerprint from your IP address. The beacon request still reaches Cloudflare,
    which says it discards the IP address at the nearest data centre and does not store it in its core databases. That data centre can be outside the United Kingdom, including in the United States. Cloudflare says it
    keeps the full beacon for 7 days, then a reduced aggregate, and that the dashboard can show the previous six months.

    <a href="https://developers.cloudflare.com/web-analytics/" target="_blank" rel="noopener noreferrer">Cloudflare Web Analytics</a>

    This button applies to this browser only. Clicking it turns Cloudflare Web Analytics off. The choice is stored in local storage under the name <span translate="no">lupaxa-cloudflare</span> with the value off, and the
    Cloudflare script is not loaded from the next page. Clicking again removes that entry, and counting resumes from the next page. A visit already sent on this page stays sent. Counter is left as it is.

    <button type="button" class="md-button lupaxa-button" data-analytics-choice data-analytics-key="lupaxa-cloudflare" data-analytics-name="Cloudflare" aria-pressed="false">Don't count my visits with Cloudflare</button>

    ### Translation

    Choosing a language other than English sends the visible wording of that page to Google, so the page can be shown in that language. If the tables on Interrogate Me are already filled, that wording includes those
    values. The site does not send them as a separate upload. URLs are left as they are. The request still comes from your connection, so Google can see the IP address that made it. Google is in the United States. This
    site does not control how long Google keeps that request.

    The lawful basis is legitimate interests in providing the language you asked for. Switching the site back to English stops further translation requests.

    ### Sponsorship

    The Ko-fi widget on the Sponsor page does not load until you click <span class="privacy-control">Open Ko-fi Widget</span> Open our Ko-fi Page takes you to Ko-fi. Ko-fi then handles that visit, including any payment,
    under its own terms. This site does not receive your card details.

    <a href="https://ko-fi.com/privacy" target="_blank" rel="noopener noreferrer">Ko-fi privacy</a>

    ### How Long Information Is Kept

    This site does not keep an account, a mailing list, or its own copy of the interrogation or the analytics. The table lasts until you leave the page. Language values stay in your browser until you clear them or change
    the language. Each analytics choice stays until you turn that tool back on or clear site data for this browser. GitHub, Cloudflare, Counter, Google, and the lookup services keep what they receive for the periods
    described above, or under their own notices where a period is not published.

    ### Who Receives Information

    GitHub receives the request that loads each page and may process it in the United States. The Cloudflare Worker receives the address lookup when Interrogate Me can reach it. Cloudflare receives the analytics beacon
    unless Cloudflare is turned off in that browser. Counter receives the visit counts and stores them in Germany, unless Counter is turned off in that browser. Google receives a
    translation request only if you choose a language other than English, and receives the STUN packet when Interrogate Me checks announced addresses. Ko-fi receives a visit only if you open the widget or the Ko-fi page.
    ipwho.is, ipapi.co, freeipapi.com, rdap.org, and kittens.sh receive a request only for the lookup that names them. The collective does not sell personal data and does not pass it to advertisers.

    A transfer to the United States is not covered by a general UK adequacy decision. It is covered where the recipient is certified under the UK-US data bridge, or where another safeguard in UK law applies. This site
    does not have its own transfer contract with GitHub, Cloudflare, or Google.

    ### Your Rights

    You can ask for a copy of the personal data this site holds about you, ask for a correction, ask for deletion, ask for processing to be restricted, and object to processing based on legitimate interests, including
    the analytics and the lookups. Where a right to move data to another service applies, you can ask for that too. Because the site does not keep accounts, there is often no file here to send, and the practical record
    is the one on your device or with the provider named above.

    Write to the <a class="legal-mail" href="mailto:compliance@thelupaxaproject.org">Lupaxa Compliance Team</a> We will reply within one month. You can also complain to the Information Commissioner's Office. You do not
    have to contact us before you complain.

    <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">Make a complaint to the ICO</a>

    ### Changes

    If the site starts collecting something new, this page will be updated and the date below will change.

    ### Last Updated

    This policy was last updated on Tuesday <span class="legal-ordinal" data-ordinal="th">24</span> November 2026.

</div>
