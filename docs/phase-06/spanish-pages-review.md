# Spanish Trust Pages — Review Packet (06-07)

**Purpose:** a side-by-side English/Spanish comparison of the four Spanish trust pages (About,
Privacy, Terms, Contact) that D-16 requires a fluent human to approve before they ship, plus the
English Privacy page's corrected Umami disclosure (D-11/T-06-26). The Spanish changelog
(`/es/changelog`, D-17) carries no translated prose — entries stay in English — so it is not
included in this review packet.

**Reviewer:** _pending — see "Reviewer decision" at the bottom._

---

## English Privacy — what changed and why (D-11, T-06-26)

Two claims on `src/pages/privacy.astro` were factually wrong and are corrected in this plan:

1. **"We use Cloudflare for hosting and basic analytics... Cloudflare's analytics are
   privacy-focused and don't use cookies."** — Wrong tool. The site's analytics are Umami, not a
   Cloudflare product. Split into two sections: Cloudflare (hosting/CDN only) and a new "Umami
   Analytics" section naming the exact instance and what it records.
2. **"Your location is your business. We never track where you are."** (under "No Location
   Tracking") — False. Umami's own documentation states it records a coarse country/region per
   page view, derived from the request's IP address. Replaced with "Coarse Location Only" /
   accurate text: no precise location, aggregate country/region only, IP address itself never
   stored.

Every other claim on the page (no PII, minimal/essential cookies, no ads, third-party content
sourcing) is unchanged from 04-08 and was not re-verified in this plan — only the analytics/
location claims were in scope.

### Umami documentation each claim rests on (fetched 2026-10-04)

| Claim on the page | Source |
|---|---|
| "no cookies in the tracking code" | https://docs.umami.is/docs/faq — "No, Umami does not use any cookies in the tracking code." |
| "no personally identifiable information... anonymized" | https://docs.umami.is/docs/faq — "Umami does not collect any personally identifiable information and anonymizes all data collected." |
| "page and referrer URL, browser, operating system, device type, screen size" | https://docs.umami.is/docs/metric-definitions — Event metrics (URL, Referrer) + Session metrics (Browser, OS, Device, Screen) |
| "your browser's language setting" | https://docs.umami.is/docs/metric-definitions — Session metrics, "Language — Navigator language property included in the payload." |
| "coarse country and region... derived from your IP address" | https://docs.umami.is/docs/metric-definitions — Location metrics: "Country — Name of country following ISO-3166 standards" / "Region — Name of region (subdivisions) following ISO-3166-2 standards." (City is also listed in Umami's schema but is not named on the page — this project has not verified live Cloudflare-header precision reaches city level on this instance, so the page claims only country/region, the conservative/narrower claim.) |
| "the IP address itself is never stored" | https://docs.umami.is/docs/metric-definitions — "Location metrics come from different sources depending on the headers. The IP address sending the request is used to gather these metrics, but is never stored." |
| "visitors are tracked anonymously without cookies" (session identification) | https://docs.umami.is/docs/sessions — "a unique hash generated from the visitor's IP address, user agent, and website ID... visitors are tracked anonymously without cookies." |

### English diff (for reference — full files are in git)

- "Our Promise" paragraph 2: names Umami explicitly instead of "self-hosted analytics."
- "What We Don't Collect" dl: `No Location Tracking` / `Your location is your business. We never
  track where you are.` → `Coarse Location Only` / accurate aggregate-location text.
- "Third Parties": split one `Cloudflare` block into `Cloudflare` (hosting/CDN only) + new
  `Umami Analytics` block with the full per-page-view disclosure and two external links (the
  instance URL, Umami's own metric-definitions doc).

---

## Page 1: About (`/about` vs `/es/about`)

| # | English (`src/pages/about.astro`) | Spanish draft (`src/pages/es/about.astro`) |
|---|---|---|
| eyebrow | Est. 2025 · El Paso, Texas | Fundado en 2025 · El Paso, Texas |
| h1 | About 915 TLDR | Acerca de 915 TLDR |
| lede | Your AI-powered window into El Paso news—aggregated, summarized, and organized for the way you read today. | Su ventana a las noticias de El Paso, impulsada por inteligencia artificial — recopiladas, resumidas y organizadas para la forma en que usted lee hoy. |
| h2 | What does "TLDR" mean? | ¿Qué significa "TLDR"? |
| p | TLDR stands for "Too Long; Didn't Read"—internet shorthand for a quick summary. When something is too long to read in full, you ask for the TLDR: just the essential points. | TLDR son las siglas en inglés de "Too Long; Didn't Read" ("muy largo; no lo leí") — una expresión de internet para pedir un resumen rápido. Cuando algo es demasiado largo para leerlo por completo, usted pide el TLDR: solo los puntos esenciales. |
| p | That's exactly what we do with El Paso news. We read it all so you don't have to, then give you the TLDR. | Eso es exactamente lo que hacemos con las noticias de El Paso. Nosotros las leemos todas para que usted no tenga que hacerlo, y luego le damos el TLDR. |
| h2 | Our Mission | Nuestra misión |
| p | We believe staying informed about your community shouldn't feel like a chore. 915 TLDR automatically collects news from El Paso's most trusted local sources, uses AI to extract key insights, and presents everything in a clean, scannable format. | Creemos que mantenerse informado sobre su comunidad no debería sentirse como una tarea pesada. 915 TLDR recopila automáticamente noticias de las fuentes locales más confiables de El Paso, usa inteligencia artificial para extraer los puntos clave, y presenta todo en un formato claro y fácil de recorrer. |
| p | No more hopping between websites. No more clickbait headlines. Just the news that matters to El Paso, delivered the way modern readers want it—fast, clear, and comprehensive. | Sin saltar de un sitio web a otro. Sin titulares sensacionalistas. Solo las noticias que le importan a El Paso, entregadas como los lectores de hoy las quieren: rápidas, claras y completas. |
| h2 | How It Works | Cómo funciona |
| p | Smart features that make local news accessible | Funciones inteligentes que hacen accesibles las noticias locales |
| dl | AI Summaries / Get the key points from every story without reading the full article. | Resúmenes con IA / Obtenga los puntos clave de cada historia sin leer el artículo completo. |
| dl | Multi-Source Coverage / See how different outlets cover the same story, all in one place. | Cobertura de múltiples fuentes / Vea cómo distintos medios cubren la misma historia, todo en un solo lugar. |
| dl | Categorized Content / Browse by topic—politics, crime, sports, business, and more. | Contenido por categorías / Explore por tema: política, crimen, deportes, negocios y más. |
| dl | Full-Text Search / Find any article on any topic with powerful search. | Búsqueda de texto completo / Encuentre cualquier artículo sobre cualquier tema con una búsqueda potente. |
| dl | Mobile Friendly / Read comfortably on any device, anywhere. | Compatible con móviles / Lea cómodamente desde cualquier dispositivo, en cualquier lugar. |
| dl | Always Updated / Fresh news automatically collected every few hours. | Siempre actualizado / Noticias nuevas recopiladas automáticamente cada pocas horas. |
| h2 | Our Sources | Nuestras fuentes |
| p | We aggregate content from El Paso's most trusted local news organizations. Every story links back to its original source—we're here to help you discover news, not replace the journalists who report it. | Recopilamos contenido de las organizaciones de noticias locales más confiables de El Paso. Cada historia enlaza a su fuente original — estamos aquí para ayudarle a descubrir noticias, no para reemplazar a los periodistas que las reportan. |
| h2 | Questions or Feedback? | ¿Preguntas o comentarios? |
| p | We'd love to hear from you. Whether you have suggestions for new sources, found a bug, or just want to say hello—reach out. | Nos encantaría saber de usted. Si tiene sugerencias de nuevas fuentes, encontró un error, o solo quiere saludar — escríbanos. |
| link | Get in Touch → /contact | Póngase en contacto → /es/contact |

**Notes for the reviewer:** category names in the "Contenido por categorías" bullet (política,
crimen, deportes, negocios) match the fixed `CATEGORY_LABELS_ES` map (`src/lib/i18n/
category-labels.ts`) used sitewide — not independently chosen wording. The English page's known
omission of a dead `/sources` link (04-08-SUMMARY.md) is preserved, not reintroduced.

---

## Page 2: Privacy (`/privacy` vs `/es/privacy`)

| # | English (corrected, `src/pages/privacy.astro`) | Spanish draft (`src/pages/es/privacy.astro`) |
|---|---|---|
| eyebrow | Last Updated · December 2025 | Última actualización · diciembre de 2025 |
| h1 | Privacy Policy | Política de privacidad |
| lede | Your privacy matters. Here's exactly how we handle (and don't handle) your data. | Su privacidad importa. Así es exactamente cómo manejamos (y cómo no manejamos) sus datos. |
| h2 | Our Promise | Nuestro compromiso |
| p | 915 TLDR is built with privacy as a core principle, not an afterthought. We believe you should be able to read local news without being tracked, profiled, or targeted. That's why we've designed this site to collect the absolute minimum data possible. | 915 TLDR está construido con la privacidad como principio fundamental, no como algo secundario. Creemos que usted debe poder leer las noticias locales sin ser rastreado, perfilado o segmentado. Por eso diseñamos este sitio para recopilar la menor cantidad de datos posible. |
| p | We use Umami, a self-hosted, cookieless analytics tool we run ourselves — it never identifies you individually. We don't sell data because we don't collect data worth selling. It's that simple. | Usamos Umami, una herramienta de análisis autoalojada y sin cookies que operamos nosotros mismos — nunca lo identifica a usted individualmente. No vendemos datos porque no recopilamos datos que valga la pena vender. Así de simple. |
| h2 | What We Don't Collect | Lo que no recopilamos |
| p | Privacy by design means saying no to unnecessary data | La privacidad por diseño significa decir no a los datos innecesarios |
| dl | No Personal Data / We don't collect names, emails, or any personally identifiable information. | Sin datos personales / No recopilamos nombres, correos electrónicos ni ningún dato de identificación personal. |
| dl | **Coarse Location Only** / We don't track your precise location. Our analytics record only a coarse, aggregate country and region derived from your IP address — the IP address itself is never stored. | **Solo ubicación aproximada** / No rastreamos su ubicación exacta. Nuestras estadísticas registran solo un país y una región aproximados, derivados de su dirección IP — la dirección IP en sí nunca se almacena. |
| dl | Minimal Cookies / Only essential cookies for site functionality—theme preference and session. | Cookies mínimas / Solo cookies esenciales para el funcionamiento del sitio: preferencia de tema y sesión. |
| dl | No Ads or Trackers / Zero third-party advertising or social media tracking scripts. | Sin anuncios ni rastreadores / Cero scripts de publicidad de terceros o de rastreo de redes sociales. |
| h2 | Third Parties | Terceros |
| h3 | Cloudflare | Cloudflare |
| p | We use Cloudflare for hosting and content delivery. Their privacy policy applies to their services. | Usamos Cloudflare para el alojamiento y la entrega de contenido. Se aplica su política de privacidad a sus servicios. |
| h3 | **Umami Analytics** (new) | **Umami Analytics** (new) |
| p | We run our own analytics, Umami, self-hosted at stats.915websites.com — your visits are never sent to a third party. Umami's tracking code uses no cookies. For each page view it records the page and referrer URL, your browser, operating system, device type and screen size, your browser's language setting, and a coarse country and region computed from your IP address at the moment of the request — the IP address itself is never stored. See Umami's own documentation for the complete list. | Usamos nuestra propia herramienta de análisis, Umami, alojada por nosotros mismos en stats.915websites.com — sus visitas nunca se envían a un tercero. El código de seguimiento de Umami no usa cookies. Por cada vista de página registra la URL de la página y la de referencia, su navegador, sistema operativo, tipo de dispositivo y tamaño de pantalla, el idioma configurado en su navegador, y un país y región aproximados calculados a partir de su dirección IP al momento de la solicitud — la dirección IP en sí nunca se almacena. Consulte la documentación oficial de Umami para ver la lista completa. |
| h2 | Content | Contenido |
| p | All news content is sourced from third-party publishers. We link to original articles and do not claim ownership of the content. Each article clearly displays its source. | Todo el contenido periodístico proviene de editores externos. Enlazamos a los artículos originales y no reclamamos la propiedad del contenido. Cada artículo muestra claramente su fuente. |
| h2 | Questions About Privacy? | ¿Preguntas sobre privacidad? |
| p | We're happy to explain anything in more detail. Reach out anytime. | Con gusto le explicamos cualquier detalle. Contáctenos cuando quiera. |
| link | Contact Us → /contact | Contáctenos → /es/contact |

**Notes for the reviewer:** this is the highest-stakes page in this packet (T-06-26). The Umami
documentation citations are in the "English Privacy" section above — please check each sentence
in the "Umami Analytics" block against that table rather than taking the translation's fluency as
a proxy for its factual accuracy.

---

## Page 3: Terms (`/terms` vs `/es/terms`)

Near-legal text — the Spanish draft preserves the exact set of obligations/disclaimers; nothing
added, nothing dropped.

| # | English (`src/pages/terms.astro`) | Spanish draft (`src/pages/es/terms.astro`) |
|---|---|---|
| eyebrow | Last Updated · December 2025 | Última actualización · diciembre de 2025 |
| h1 | Terms of Service | Términos de servicio |
| lede | The ground rules for using 915 TLDR. Plain language, no legal jargon maze. | Las reglas básicas para usar 915 TLDR. En lenguaje claro, sin laberintos legales. |
| h2 | The Agreement | El acuerdo |
| p | By using 915 TLDR, you're agreeing to these terms. We've kept them straightforward because nobody enjoys reading dense legal documents. If something here doesn't work for you, that's okay—but please don't use the service. | Al usar 915 TLDR, usted acepta estos términos. Los mantenemos sencillos porque a nadie le gusta leer documentos legales densos. Si algo aquí no le funciona, está bien — pero por favor no use el servicio. |
| p | We're a news aggregator, not a news publisher. We collect stories from local El Paso sources, use AI to create summaries, and organize everything in one place. The original reporting always belongs to the journalists who created it. | Somos un agregador de noticias, no un medio de comunicación. Recopilamos historias de fuentes locales de El Paso, usamos inteligencia artificial para crear resúmenes, y organizamos todo en un solo lugar. El reportaje original siempre pertenece a los periodistas que lo crearon. |
| h2 | Key Points | Puntos clave |
| p | The important stuff, summarized | Lo importante, resumido |
| dl | AI Summaries / Content is AI-generated and may contain errors. Always verify with original sources. | Resúmenes con IA / El contenido es generado por inteligencia artificial y puede contener errores. Verifique siempre con las fuentes originales. |
| dl | Third-Party Content / All news originates from external publishers. We link, aggregate, and summarize. | Contenido de terceros / Todas las noticias provienen de editores externos. Nosotros enlazamos, recopilamos y resumimos. |
| dl | Fair Use / Summaries are for informational purposes. Original content belongs to publishers. | Uso legítimo / Los resúmenes tienen fines informativos. El contenido original pertenece a los editores. |
| dl | As-Is Service / No warranties on accuracy or availability. Use at your own discretion. | Servicio "tal cual" / Sin garantías de exactitud ni disponibilidad. Úselo bajo su propio criterio. |
| h2 | AI Content | Contenido de IA |
| p | Our summaries are generated by artificial intelligence. AI is helpful but not perfect—it can misinterpret context, miss nuance, or occasionally get facts wrong. We do our best to ensure quality, but for anything important, click through to the original article. | Nuestros resúmenes son generados por inteligencia artificial. La IA es útil, pero no es perfecta — puede malinterpretar el contexto, pasar por alto matices, o en ocasiones equivocarse en los hechos. Hacemos lo posible por garantizar la calidad, pero para cualquier asunto importante, consulte el artículo original. |
| p | The categorizations, tags, and topic assignments are also AI-generated. If you notice something miscategorized, it's the robot's fault, not the original reporters. | Las categorías, etiquetas y asignaciones de tema también son generadas por IA. Si nota algo mal categorizado, es culpa del sistema automático, no de los reporteros originales. |
| h2 | Third Parties | Terceros |
| p | Every article on 915 TLDR comes from an external news source. We link to these sources prominently because they deserve the credit and the traffic. We don't control their content, their accuracy, or their editorial decisions. | Cada artículo en 915 TLDR proviene de una fuente de noticias externa. Enlazamos a estas fuentes de manera visible porque merecen el crédito y el tráfico. No controlamos su contenido, su exactitud, ni sus decisiones editoriales. |
| p | When you click an external link, you're leaving our site and entering theirs. Their terms and privacy policies apply once you're there. | Cuando usted hace clic en un enlace externo, sale de nuestro sitio y entra al de ellos. Sus términos y políticas de privacidad aplican una vez que usted está ahí. |
| h2 | Ownership | Propiedad |
| p | Original news content belongs to the publishers who created it. Our AI-generated summaries exist to help you discover news, not to replace reading the actual articles. | El contenido periodístico original pertenece a los editores que lo crearon. Nuestros resúmenes generados por IA existen para ayudarle a descubrir noticias, no para reemplazar la lectura de los artículos reales. |
| p | The 915 TLDR name, logo, and the design of this website are our intellectual property. | El nombre "915 TLDR", el logotipo y el diseño de este sitio web son propiedad intelectual nuestra. |
| h2 | Disclaimers | Exenciones de responsabilidad |
| p | 915 TLDR is provided "as is." We don't guarantee uptime, accuracy, or that every article summary will be perfect. We're a small project trying to help El Pasoans stay informed, not a Fortune 500 company with lawyers on retainer. | 915 TLDR se ofrece "tal cual". No garantizamos el tiempo de actividad, la exactitud, ni que cada resumen de artículo sea perfecto. Somos un proyecto pequeño que intenta ayudar a los habitantes de El Paso a mantenerse informados, no una empresa grande con abogados de planta. |
| p | We're not liable for decisions you make based on information you find here. For important matters—legal, medical, financial—always consult authoritative sources and professionals. | No somos responsables de las decisiones que usted tome con base en la información que encuentre aquí. Para asuntos importantes — legales, médicos, financieros — consulte siempre fuentes autorizadas y profesionales. |
| h2 | Changes | Cambios |
| p | We may update these terms as the service evolves. When we make significant changes, we'll update the "Last Updated" date at the top. Continuing to use the service after changes means you accept the new terms. | Podemos actualizar estos términos a medida que el servicio evoluciona. Cuando hagamos cambios significativos, actualizaremos la fecha de "Última actualización" en la parte superior. Si continúa usando el servicio después de los cambios, significa que acepta los nuevos términos. |
| h2 | Questions About These Terms? | ¿Preguntas sobre estos términos? |
| p | We're happy to clarify anything. Reach out and we'll explain in plain English. | Con gusto le aclaramos cualquier duda. Escríbanos y le explicaremos en lenguaje claro. |
| link | Contact Us → /contact | Contáctenos → /es/contact |

**Notes for the reviewer:** please check specifically that no sentence adds or drops an
obligation/disclaimer relative to the English column — e.g. "As-Is Service" → `Servicio "tal
cual"` keeps the no-warranty scope identical (accuracy + availability only, nothing broader).

---

## Page 4: Contact (`/contact` vs `/es/contact`)

| # | English (`src/pages/contact.astro`) | Spanish draft (`src/pages/es/contact.astro`) |
|---|---|---|
| h1 | Contact | Contacto |
| intro | I'm Jaime Aleman, a web developer here in El Paso, and I built 915 TLDR myself. Every summary on this site is written by AI from reporting by KTSM, KVIA and other local outlets — I did not report any of it, and I say so plainly on every story. What I do is pull the day's local news into one place, tag and de-duplicate it, and publish it free and without ads, in the open, with every change documented on the changelog. | Soy Jaime Aleman, desarrollador web aquí en El Paso, y yo mismo construí 915 TLDR. Cada resumen en este sitio está escrito por inteligencia artificial a partir del reportaje de KTSM, KVIA y otros medios locales — yo no reporté nada de esto, y lo digo claramente en cada historia. Lo que hago es reunir las noticias locales del día en un solo lugar, etiquetarlas y eliminar duplicados, y publicarlas gratis y sin anuncios, de manera abierta, documentando cada cambio en el registro de cambios. |
| links | You can also find me directly at jjaimealeman.com and 915website.com, where I build sites like this one for other El Paso businesses. | También puede encontrarme directamente en jjaimealeman.com y 915website.com, donde construyo sitios como este para otros negocios de El Paso. |
| form-note | This form isn't accepting messages on this build yet — submission is wired in a later phase. In the meantime, reach out via the links above. | Este formulario no está aceptando mensajes en esta versión todavía — el envío se habilitará en una fase posterior. Mientras tanto, contáctenos a través de los enlaces de arriba. |
| field | Name (required) | Nombre (obligatorio) |
| field | Email (required) | Correo electrónico (obligatorio) |
| field | Your message (required) | Su mensaje (obligatorio) |
| button | Send message | Enviar mensaje |
| rail heading | Latest Stories (dictionary `railLatestHeading`) | Últimas noticias (dictionary `railLatestHeading`, `t('railLatestHeading', 'es')`) |

**Notes for the reviewer:** the rail heading/aria-label are drawn from the existing fixed
dictionary (`src/lib/i18n/dictionary.ts`), already approved in 06-05 — not new prose needing
review here. The rail cards themselves show each article's real Spanish title when one exists
(via `localizedArticleView`) or the English fallback marked `lang="en"` per article (D-05) — card
content is data-driven, not something this packet can show statically.

---

## Reviewer decision

- **Reviewer name:** _pending_
- **Date:** _pending_
- **Decision:** _pending — approved as-is / approved with edits (list below) / rejected_
- **Edits requested (if any):** _none recorded yet_
