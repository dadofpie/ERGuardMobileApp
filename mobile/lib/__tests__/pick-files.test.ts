import { computeResize } from '../pick-files';

describe('computeResize', () => {
  it('leaves small images alone', () => {
    expect(computeResize(1600, 1200)).toBeNull();
  });
  it('caps the longer side at 2000', () => {
    expect(computeResize(4000, 3000)).toEqual({ width: 2000 });
    expect(computeResize(3000, 4000)).toEqual({ height: 2000 });
  });
});
