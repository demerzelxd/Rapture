import { absoluteUrl, escapeXml, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/site';

export function GET() {
  const searchTemplate = `${SITE_URL}/search/?q={searchTerms}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${escapeXml(SITE_NAME)}</ShortName>
  <Description>${escapeXml(`Search ${SITE_DESCRIPTION}`)}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Image height="16" width="16" type="image/png">${escapeXml(absoluteUrl('/favicon.png'))}</Image>
  <Url type="text/html" method="get" template="${escapeXml(searchTemplate)}" />
</OpenSearchDescription>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml; charset=utf-8',
    },
  });
}
