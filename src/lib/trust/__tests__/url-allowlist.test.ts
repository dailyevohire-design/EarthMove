import { describe, it, expect } from 'vitest';
import { isAllowedSourceUrl } from '../url-allowlist';

describe('isAllowedSourceUrl — happy path', () => {
  it.each([
    'https://www.osha.gov/pls/imis/establishment.html',
    'https://api.sam.gov/entity-information/v4',
    'https://efts.sec.gov/LATEST/search-index',
    'https://api.usaspending.gov/api/v2/search',
    'https://www.bbb.org/us/co/denver/profile/x',
    'https://www.courtlistener.com/api/rest/v3/search/',
    'https://maps.googleapis.com/maps/api/place/details/json',
    'https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do',
    'https://search.sunbiz.org/Inquiry/CorporationSearch',
    'https://www.myfloridalicense.com/wl11.asp',
    'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/',
    'https://bizfileonline.sos.ca.gov/',
    'https://ecorp.azcc.gov/EntitySearch/Index',
    'https://roc.az.gov/',
    'https://portal.nclbgc.org/',
    'https://www.denvergov.org/contractorlicensing',
    'https://www.oregon.gov/ccb/',
  ])('admits %s', (url) => {
    const r = isAllowedSourceUrl(url);
    expect(r.allowed).toBe(true);
  });
});

describe('isAllowedSourceUrl — rejects exploits', () => {
  it('rejects http (non-tls)', () => {
    const r = isAllowedSourceUrl('http://www.osha.gov/');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_https');
  });

  it('rejects URLs with credentials', () => {
    const r = isAllowedSourceUrl('https://user:pass@osha.gov/');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('has_credentials');
  });

  it('rejects evil.com.gov (PSL handles com.gov as registrable)', () => {
    const r = isAllowedSourceUrl('https://evil.com.gov/x');
    expect(r.allowed).toBe(false);
  });

  it('rejects gov.evil.com (registrable evil.com)', () => {
    const r = isAllowedSourceUrl('https://gov.evil.com/sam.gov');
    expect(r.allowed).toBe(false);
  });

  it('rejects notgov.io', () => {
    const r = isAllowedSourceUrl('https://notgov.io/');
    expect(r.allowed).toBe(false);
  });

  it('rejects evil-osha.gov (registrable evil-osha.gov, not osha.gov)', () => {
    const r = isAllowedSourceUrl('https://evil-osha.gov/');
    expect(r.allowed).toBe(false);
  });

  it('rejects subdomain spoofing osha.gov.attacker.io', () => {
    const r = isAllowedSourceUrl('https://osha.gov.attacker.io/');
    expect(r.allowed).toBe(false);
  });

  it('rejects malformed URLs', () => {
    const r = isAllowedSourceUrl('not a url');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('invalid_url');
  });
});
