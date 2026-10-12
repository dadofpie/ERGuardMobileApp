import { extractHandoffToken, isAllowedActivationUrl } from '../activation';

describe('activation urls', () => {
  it('allows only https on trusted hosts', () => {
    expect(isAllowedActivationUrl('https://api.app.medicareplus.com.ph/a?x=1')).toBe(true);
    expect(isAllowedActivationUrl('http://api.app.medicareplus.com.ph/a')).toBe(false);
    expect(isAllowedActivationUrl('https://evil.example.com/a')).toBe(false);
    expect(isAllowedActivationUrl('https://api.app.medicareplus.com.ph@evil.com/')).toBe(false);
    expect(isAllowedActivationUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedActivationUrl('https://shop.medicareplus.com.ph/x', ['shop.medicareplus.com.ph'])).toBe(true);
  });
  it('extracts handoff tokens from deep links', () => {
    const token = 'abcDEF1234567890abcdef';
    expect(extractHandoffToken(`erguard://erguard/activation?handoff=${token}`)).toBe(token);
    expect(extractHandoffToken(`https://api.app.medicareplus.com.ph/erguard/activation?handoff=${token}`)).toBe(token);
    expect(extractHandoffToken(`https://evil.com/erguard/activation?handoff=${token}`)).toBeNull();
    expect(extractHandoffToken('erguard://erguard/activation?handoff=short')).toBeNull();
    expect(extractHandoffToken(null)).toBeNull();
  });
});
