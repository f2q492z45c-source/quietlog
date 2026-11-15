const KEY = "quietlog_events_v1";
let audioContext = null, analyser = null, stream = null, raf = null;
const $ = id => document.getElementById(id);
let events = JSON.parse(localStorage.getItem(KEY) || "[]");

function save(){ localStorage.setItem(KEY, JSON.stringify(events)); render(); }
function stamp(iso){ const d=new Date(iso); return d.toLocaleDateString("fr-FR")+" à "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function render(){
  $("totalCount").textContent = `${events.length} événement${events.length>1?"s":""}`;
  const today=new Date().toLocaleDateString("fr-FR");
  $("countToday").textContent=events.filter(e=>new Date(e.time).toLocaleDateString("fr-FR")===today).length;
  const box=$("events");
  if(!events.length){box.innerHTML='<p class="empty">Aucun événement enregistré.</p>';return;}
  box.innerHTML=events.slice().reverse().map(e=>`
    <div class="event">
      <div class="eventhead"><span>${escapeHtml(e.kind)}</span><button class="delete" data-delete="${e.id}">Supprimer</button></div>
      <div class="eventmeta">${stamp(e.time)}${e.duration?" • "+escapeHtml(e.duration):""}</div>
      ${e.notes?`<div class="eventnote">${escapeHtml(e.notes)}</div>`:""}
    </div>`).join("");
  box.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{events=events.filter(e=>e.id!==b.dataset.delete);save();}));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

$("addEvent").addEventListener("click",()=>{
  events.push({id:crypto.randomUUID(),time:new Date().toISOString(),kind:$("kind").value,duration:$("duration").value.trim(),notes:$("notes").value.trim()});
  $("duration").value="";$("notes").value="";save();
});
$("exportCsv").addEventListener("click",()=>{
  const rows=[["Date/heure","Type","Durée","Observations"],...events.map(e=>[stamp(e.time),e.kind,e.duration,e.notes])];
  const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
  download(new Blob([csv],{type:"text/csv;charset=utf-8"}),"QUIETLOG_journal.csv");
});
$("printReport").addEventListener("click",()=>window.print());
$("emailHelp").addEventListener("click",()=>{
  const body="Bonjour,\n\nVeuillez trouver ci-joint les éléments du journal QUIETLOG concernant les événements sonores constatés.\n\nCordialement,";
  location.href="mailto:?subject="+encodeURIComponent("Transmission du journal QUIETLOG")+"&body="+encodeURIComponent(body);
});
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}

async function startMic(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioContext=new (window.AudioContext||window.webkitAudioContext)();
    analyser=audioContext.createAnalyser();analyser.fftSize=1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const data=new Uint8Array(analyser.fftSize);
    $("statusText").textContent="Test microphone actif";$("statusDot").parentElement.classList.add("active");
    $("startMic").disabled=true;$("stopMic").disabled=false;
    $("micMessage").textContent="Mesure relative en cours. Aucun son n'est sauvegardé.";
    const tick=()=>{
      analyser.getByteTimeDomainData(data);
      let sum=0;for(const v of data){const x=(v-128)/128;sum+=x*x;}
      const rms=Math.sqrt(sum/data.length), level=Math.min(100,Math.round(rms*260));
      $("level").textContent=level+"/100";$("meterFill").style.width=level+"%";
      raf=requestAnimationFrame(tick);
    };tick();
  }catch(err){$("micMessage").textContent="Accès au microphone impossible : vérifie les autorisations et ouvre QUIETLOG en HTTPS."; }
}
function stopMic(){
  if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());
  if(audioContext)audioContext.close();stream=null;audioContext=null;
  $("statusText").textContent="Microphone arrêté";$("statusDot").parentElement.classList.remove("active");
  $("startMic").disabled=false;$("stopMic").disabled=true;$("level").textContent="—";$("meterFill").style.width="0";
  $("micMessage").textContent="Test arrêté. Aucun son n'a été enregistré.";
}
$("startMic").addEventListener("click",startMic);$("stopMic").addEventListener("click",stopMic);
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
render();
