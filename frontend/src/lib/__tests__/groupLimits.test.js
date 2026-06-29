import {
  DEFAULT_MAX_GROUP_PARTICIPANTS,
  isGroupFull,
  maxInitialGroupPicks,
  remainingGroupSlots,
} from '../groupLimits';

describe('groupLimits', () => {
  it('computes remaining slots toward 50', () => {
    expect(remainingGroupSlots(48)).toBe(2);
    expect(remainingGroupSlots(50)).toBe(0);
    expect(isGroupFull(50)).toBe(true);
  });

  it('limits initial create picks to max minus self', () => {
    expect(maxInitialGroupPicks(DEFAULT_MAX_GROUP_PARTICIPANTS)).toBe(49);
  });
});