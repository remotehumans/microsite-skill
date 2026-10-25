// Human approval publishes the exact page version shown in the inspector.
(()=>{
  const style=document.createElement('style');
  style.textContent='[data-deployment-review] label{display:grid;gap:8px;margin:16px 0}[data-deployment-review] textarea{display:block;box-sizing:border-box;width:100%;min-height:80px;padding:12px;border:1px solid #d1ccc3;border-radius:10px;background:transparent;color:inherit;font:inherit;resize:vertical}[data-deploy-warning]{padding:12px;border-left:3px solid #e04f18}[data-deploy-warning][hidden],[data-live-link][hidden]{display:none}';
  document.head.append(style);
  const labels={ready_for_review:'Ready for your review',checks_pending:'Automated checks are out of date',changes_requested:'Changes requested',queued:'Queued for deployment…',deploying:'Deploying…',deployment_failed:'Deployment needs attention',approval_expired:'Page changed · review again',deployed:'Live · share link verified'};
  let request=0,poll;
  async function show(){
    const r=current;if(!r?.page||!document.querySelector('#reviewer')?.open)return;
    const evidence=document.querySelector('#evidence');
    if(evidence.querySelector('[data-deployment-review]'))return;
    clearTimeout(poll);
    const panel=document.createElement('section');panel.dataset.deploymentReview='';panel.className='share-box';
    panel.innerHTML='<h3>Review this page</h3><p data-review-state role="status">Loading deployment status…</p>';
    evidence.prepend(panel);const token=++request;
    try{
      const response=await fetch('/api/page-reviews?id='+encodeURIComponent(r.id));let state=await response.json();
      if(!response.ok)throw new Error(state.error||'Could not load the review.');
      if(token!==request||current?.id!==r.id||!panel.isConnected)return;
      panel.innerHTML='<h3>Review this page</h3><p data-review-state role="status" aria-live="polite"></p><p data-deploy-warning hidden></p><p data-live-link hidden><a target="_blank" rel="noopener">Open live page ↗</a></p><label>Feedback<textarea data-review-notes placeholder="Any changes for this page?"></textarea></label><div class="contact-actions"><button data-decision="changes_requested">Request changes</button><button data-decision="approved_to_deploy">Deploy to my site</button></div><p class="small">Deploy publishes this exact version at an unlisted link on your website. It stays out of search results. Sending the link is a separate action.</p>';
      const viewedHash=state.page_sha256,draftKey='rh-page-review-draft-v1:'+r.id;
      const notes=panel.querySelector('[data-review-notes]');
      let draft;try{draft=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{}
      notes.value=typeof draft?.notes==='string'?draft.notes:state.notes;
      const draftStatus=document.createElement('p');draftStatus.className='small';notes.closest('label').after(draftStatus);
      if(draft)draftStatus.textContent='Unsent feedback restored from this browser.';
      notes.addEventListener('input',()=>{try{localStorage.setItem(draftKey,JSON.stringify({notes:notes.value,page_sha256:viewedHash}));draftStatus.textContent='Draft saved in this browser.';}catch{draftStatus.textContent='Keep a copy of your feedback before reloading.';}});
      const reload=document.createElement('button');reload.textContent='Reload latest page';reload.hidden=true;reload.addEventListener('click',()=>location.reload());panel.querySelector('.contact-actions').after(reload);
      const connected=()=>token===request&&current?.id===r.id&&panel.isConnected&&document.querySelector('#reviewer')?.open;
      const busy=()=>['queued','running'].includes(state.deployment?.status);
      function render(){
        const changed=state.page_sha256!==viewedHash;
        panel.querySelector('[data-review-state]').textContent=changed?(state.stage==='changes_requested'?'Feedback saved. A newer page is available; reload before deploying.':'The page was updated. You can send feedback now, or reload before deploying.'):state.deployment?.message||labels[state.stage]||state.stage;
        reload.hidden=!changed;
        const warning=panel.querySelector('[data-deploy-warning]');warning.hidden=!state.warning;warning.textContent=state.warning||'';
        const link=panel.querySelector('[data-live-link]');link.hidden=!state.deployed_url;
        if(state.deployed_url){link.querySelector('a').href=state.deployed_url;r.published={url:state.deployed_url};}
        panel.querySelectorAll('[data-decision]').forEach(b=>b.disabled=busy()||(b.dataset.decision==='approved_to_deploy'&&(!state.can_approve||changed)));
        const button=panel.querySelector('[data-decision=approved_to_deploy]');
        button.textContent=busy()?'Deploying…':state.stage==='deployment_failed'?'Retry deployment':state.stage==='deployed'?'Deploy this version again':'Deploy to my site';
      }
      async function refresh(){
        if(!connected())return;
        try{
          const response=await fetch('/api/page-reviews?id='+encodeURIComponent(r.id));const fresh=await response.json();
          if(!response.ok)throw new Error(fresh.error||'Could not refresh deployment status.');
          if(!connected())return;
          state=fresh;render();
        }catch(error){if(connected())panel.querySelector('[data-review-state]').textContent=error.message+' Reconnecting…';}
        if(connected())poll=setTimeout(refresh,busy()?2000:10000);
      }
      render();poll=setTimeout(refresh,busy()?2000:10000);
      panel.querySelectorAll('[data-decision]').forEach(button=>button.addEventListener('click',async()=>{
        clearTimeout(poll);panel.querySelectorAll('button').forEach(b=>b.disabled=true);
        const status=panel.querySelector('[data-review-state]');status.textContent=button.dataset.decision==='approved_to_deploy'?'Starting deployment…':'Saving your decision…';
        const submittedNotes=notes.value;
        try{
          const result=await fetch('/api/page-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,decision:button.dataset.decision,page_sha256:viewedHash,revision:state.revision,acknowledge_pending_checks:!state.checks_current&&!!state.warning,notes:submittedNotes})});
          const saved=await result.json();if(!result.ok)throw new Error(saved.error||'Decision was not saved.');
          if(!connected())return;state=saved;render();
          if(notes.value===submittedNotes){try{localStorage.removeItem(draftKey);}catch{}draftStatus.textContent='Feedback saved.';}
        }catch(error){if(connected()){render();status.textContent=error.message;}}
        finally{if(connected())poll=setTimeout(refresh,2000);}
      }));
    }catch(error){if(panel.isConnected)panel.querySelector('[data-review-state]').textContent=error.message;}
  }
  new MutationObserver(show).observe(document.querySelector('#evidence'),{childList:true});
})();
