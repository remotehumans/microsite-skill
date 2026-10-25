import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personEmail,compileContacts,isSharedEmail} from './build-contacts.mjs';

test('a company inbox is never presented as a named person email',()=>{
  assert.equal(isSharedEmail('info@example.com'),true);
  assert.equal(isSharedEmail('mail@example.com'),true);
  assert.equal(personEmail({name:'Alice Smith',email:'info@example.com'},'Alice Smith'),null);
  assert.equal(personEmail({name:'Bob Jones',email:'bob.jones@example.com'},'Alice Smith'),null);
  assert.equal(personEmail({name:'Alice Smith',public_business_email:'alice@example.com'},'Alice Smith'),'alice@example.com');
});
test('exact profile evidence and unresolved searches remain distinct',()=>{
  const row={id:'acme',name:'Acme',buyer:[{name:'Alice Smith',email:'alice@example.com'}],public_contact:{email:'info@example.com'},research:'research/acme.json'};
  const result=compileContacts([row],{acme:[['Alice Smith','Operations Director','Owns the work.'],['Bob Jones','Director','Check role.']]},{},{acme:[{url:'https://www.linkedin.com/in/alice-smith-123',file:'research/team.html'}]}).acme;
  assert.equal(result.people[0].email,'alice@example.com');
  assert.equal(result.people[0].linkedin,'https://www.linkedin.com/in/alice-smith-123');
  assert.equal(result.people[0].linkedin_source,'research/team.html');
  assert.equal(result.people[1].linkedin,null);
  assert.equal(result.people[1].email,null);
  assert.ok(result.people[1].search_url.includes('Bob%20Jones%20Acme'));
  assert.deepEqual(result.company_emails.map(x=>x.email),['info@example.com']);
});
