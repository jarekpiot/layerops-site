// Embeddable chat widget for client websites
// Usage: <script src="https://clients.layerops.tech/widget/slugname"></script>

export function WIDGET_JS(config) {
  const c = config;
  const primary = c.brand_color || '#2B6777';
  const name = (c.business_name || 'Assistant').replace(/'/g, "\\'");
  const greeting = (c.chat_greeting || `Hi! I'm the ${c.business_name} assistant. How can I help you today?`).replace(/'/g, "\\'");
  const slug = c.slug || '';
  const chatEndpoint = `https://${slug}.layerops.tech`;

  return `(function(){
  if(document.getElementById('lo-widget'))return;

  var PRIMARY='${primary}';
  var NAME='${name}';
  var GREETING='${greeting}';
  var CHAT_URL='${chatEndpoint}';

  // Inject styles
  var style=document.createElement('style');
  style.textContent=\`
    #lo-widget *{margin:0;padding:0;box-sizing:border-box;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;}
    #lo-toggle{position:fixed;bottom:24px;right:24px;width:60px;height:60px;background:\${PRIMARY};border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:all 0.3s;z-index:99999;border:none;color:white;font-size:1.5rem;}
    #lo-toggle:hover{transform:scale(1.08);}
    #lo-badge{position:absolute;top:-4px;right:-4px;background:#E6533C;color:white;font-size:0.7rem;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;animation:lo-pulse 2s infinite;}
    @keyframes lo-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}
    #lo-window{position:fixed;bottom:96px;right:24px;width:380px;max-height:520px;background:white;border-radius:20px;box-shadow:0 8px 48px rgba(0,0,0,0.12);display:flex;flex-direction:column;z-index:100000;overflow:hidden;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);transform-origin:bottom right;}
    #lo-window.lo-closed{opacity:0;transform:scale(0.8) translateY(20px);pointer-events:none;}
    #lo-window.lo-open{opacity:1;transform:scale(1) translateY(0);pointer-events:all;}
    #lo-header{background:#FDFAF5;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F5EDE0;}
    #lo-hname{font-weight:600;font-size:0.9rem;color:#2A2A2A;}
    #lo-hstatus{font-size:0.75rem;color:#34C759;}
    #lo-close{background:none;border:none;color:#6B6B6B;font-size:1.4rem;cursor:pointer;padding:4px 8px;}
    #lo-msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;max-height:360px;min-height:200px;background:#FDFAF5;}
    .lo-msg{display:flex;}
    .lo-bot{justify-content:flex-start;}
    .lo-usr{justify-content:flex-end;}
    .lo-bub{max-width:85%;padding:12px 16px;border-radius:16px;font-size:0.88rem;line-height:1.6;}
    .lo-bub-b{background:white;color:#3D3D3D;border:1px solid #F5EDE0;border-bottom-left-radius:4px;}
    .lo-bub-u{background:\${PRIMARY};color:white;border-bottom-right-radius:4px;}
    .lo-typ{display:flex;gap:4px;padding:12px 16px;background:white;border:1px solid #F5EDE0;border-radius:16px;border-bottom-left-radius:4px;max-width:60px;}
    .lo-typ span{width:6px;height:6px;background:#6B6B6B;border-radius:50%;animation:lo-typ 1.4s ease-in-out infinite;}
    .lo-typ span:nth-child(2){animation-delay:0.2s;}
    .lo-typ span:nth-child(3){animation-delay:0.4s;}
    @keyframes lo-typ{0%,60%,100%{opacity:0.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-4px);}}
    #lo-input-area{padding:16px;background:white;border-top:1px solid #F5EDE0;display:flex;gap:8px;}
    #lo-input{flex:1;border:1px solid #F5EDE0;border-radius:12px;padding:10px 16px;font-size:0.88rem;font-family:inherit;outline:none;background:#FDFAF5;}
    #lo-input:focus{border-color:\${PRIMARY};}
    #lo-send{width:42px;height:42px;background:\${PRIMARY};color:white;border:none;border-radius:12px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;}
    @media(max-width:480px){#lo-window{width:calc(100vw - 32px);right:16px;bottom:88px;max-height:70vh;}}
  \`;
  document.head.appendChild(style);

  // Build widget
  var w=document.createElement('div');
  w.id='lo-widget';
  w.innerHTML=\`
    <button id="lo-toggle" onclick="window._loToggle()">💬<span id="lo-badge">1</span></button>
    <div id="lo-window" class="lo-closed">
      <div id="lo-header">
        <div><div id="lo-hname">\${NAME}</div><div id="lo-hstatus">● Online</div></div>
        <button id="lo-close" onclick="window._loToggle()">×</button>
      </div>
      <div id="lo-msgs"><div class="lo-msg lo-bot"><div class="lo-bub lo-bub-b">\${GREETING}</div></div></div>
      <div id="lo-input-area">
        <input type="text" id="lo-input" placeholder="Ask me anything..." onkeydown="if(event.key==='Enter')window._loSend()">
        <button id="lo-send" onclick="window._loSend()">→</button>
      </div>
    </div>
  \`;
  document.body.appendChild(w);

  var open=false,badge=true,hist=[];

  window._loToggle=function(){
    open=!open;
    var el=document.getElementById('lo-window');
    el.classList.toggle('lo-open',open);
    el.classList.toggle('lo-closed',!open);
    if(open&&badge){document.getElementById('lo-badge').style.display='none';badge=false;}
    if(open)document.getElementById('lo-input').focus();
  };

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function render(s){
    var h=esc(s);
    h=h.replace(/\\n/g,'<br>');
    h=h.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
    h=h.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:'+PRIMARY+';text-decoration:underline;">$1</a>');
    return h;
  }

  window._loSend=async function(){
    var input=document.getElementById('lo-input');
    var msg=input.value.trim();
    if(!msg)return;
    input.value='';
    var msgs=document.getElementById('lo-msgs');

    hist.push({role:'user',content:msg});
    if(hist.length>20)hist=hist.slice(-20);

    var ud=document.createElement('div');
    ud.className='lo-msg lo-usr';
    ud.innerHTML='<div class="lo-bub lo-bub-u">'+esc(msg)+'</div>';
    msgs.appendChild(ud);

    var td=document.createElement('div');
    td.className='lo-msg lo-bot';
    td.id='lo-typing';
    td.innerHTML='<div class="lo-typ"><span></span><span></span><span></span></div>';
    msgs.appendChild(td);
    msgs.scrollTop=msgs.scrollHeight;

    try{
      var resp=await fetch(CHAT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,history:hist})});
      var data=await resp.json();
      var reply=data.reply||"Sorry, I'm having trouble. Please call us directly.";
      hist.push({role:'assistant',content:reply});
      if(hist.length>20)hist=hist.slice(-20);
      var el=document.getElementById('lo-typing');if(el)el.remove();
      var bd=document.createElement('div');
      bd.className='lo-msg lo-bot';
      bd.innerHTML='<div class="lo-bub lo-bub-b">'+render(reply)+'</div>';
      msgs.appendChild(bd);
    }catch(e){
      var el=document.getElementById('lo-typing');if(el)el.remove();
      var ed=document.createElement('div');
      ed.className='lo-msg lo-bot';
      ed.innerHTML='<div class="lo-bub lo-bub-b">Sorry, I\\'m having trouble connecting. Please call us directly.</div>';
      msgs.appendChild(ed);
    }
    msgs.scrollTop=msgs.scrollHeight;
  };
})();`;
}
