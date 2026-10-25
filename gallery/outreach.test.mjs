// ABOUTME: Tests outreach status validation for the gallery.
// ABOUTME: Uses invalid inputs only, so the outreach log is never written.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveOutreach, OUTREACH_STATUSES} from './server.mjs';

test('outreach status rejects unknown companies and statuses before writing',()=>{
  const ids=new Set(['border-biscuits']);
  assert.throws(()=>saveOutreach(ids,{id:'nope',status:'contacted'}),/Unknown company/);
  assert.throws(()=>saveOutreach(ids,{id:'border-biscuits',status:'spam'}),/Unknown status/);
  assert.ok(OUTREACH_STATUSES.includes('call_booked'));
});
