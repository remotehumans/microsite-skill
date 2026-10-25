// ABOUTME: Reads the skill's own saved checks for one built page: lint (the build only writes after it passes), fidelity and QA.
// ABOUTME: A check counts only when it was saved after the page was last built.
import fs from 'node:fs';
import path from 'node:path';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function pageChecks(folder,page){
  if(!page)return {built:false,ready:false,problem:'No page built yet.'};
  const built=fs.statSync(page).mtimeMs,saved=name=>{const f=path.join(folder,name);return fs.existsSync(f)&&fs.statSync(f).mtimeMs>=built?read(f):null;};
  const f=saved('design/fidelity.json'),qa=saved('qa/results.json');
  const fidelity=f?{desktop:f.desktop?.score??null,phone:f.phone?.score??null,threshold:f.threshold??80}:null;
  if(fidelity)fidelity.pass=[fidelity.desktop,fidelity.phone].filter(v=>v!==null).every(v=>v>=fidelity.threshold)&&fidelity.desktop!==null;
  const problem=!fidelity?'Run the fidelity check on this version.':!fidelity.pass?'Below the fidelity threshold. Fix the look, rebuild and score again.':null;
  return {built:true,fidelity,qa:!!qa,ready:!problem,problem};
}
