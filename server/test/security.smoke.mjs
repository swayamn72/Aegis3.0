import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, buildSafeRegex } from '../utils/escapeRegex.js';
import { toPublicMatch, getTeamIdsFromMatch } from '../utils/matchHelpers.js';

describe('escapeRegex', () => {
  it('escapes metacharacters', () => {
    assert.equal(escapeRegex('a+b(c)'), 'a\\+b\\(c\\)');
  });

  it('buildSafeRegex does not throw on malicious input', () => {
    const re = buildSafeRegex('(.*)+');
    assert.equal(re.test('literal'), false);
  });
});

describe('matchHelpers', () => {
  it('strips roomCredentials from public match', () => {
    const out = toPublicMatch({
      _id: '1',
      roomCredentials: { password: 'secret' },
      map: 'Ascent',
    });
    assert.equal(out.roomCredentials, undefined);
    assert.equal(out.map, 'Ascent');
  });

  it('collects team ids from results', () => {
    const ids = getTeamIdsFromMatch({
      results: [{ team: { _id: 'aaa' } }, { team: 'bbb' }],
    });
    assert.deepEqual(ids.sort(), ['aaa', 'bbb']);
  });
});
