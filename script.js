/* EcoGuard demo application
   All readings are simulated. LocalStorage keeps the demo state in this browser. */
"use strict";

const STORAGE_KEY = "ecoguard-demo-v1";
const LOCATIONS = [
  {id:"science",name:"Science Block",type:"Academic building",electricBase:145,waterBase:1850},
  {id:"library",name:"Central Library",type:"Academic building",electricBase:112,waterBase:920},
  {id:"admin",name:"Admin Block",type:"Administrative building",electricBase:86,waterBase:710},
  {id:"hostel-a",name:"Boys Hostel A",type:"Hostel block",electricBase:168,waterBase:3200},
  {id:"hostel-b",name:"Girls Hostel B",type:"Hostel block",electricBase:154,waterBase:2950}
];
const $ = id => document.getElementById(id);
let state;
let selectedZone = "science";
let trendChart, compareChart, zoneChart;
let toastTimer;

function randomBetween(min,max){ return Math.random()*(max-min)+min; }
function makeReading(zone, factor=1){
  return {
    electricity: Math.round(zone.electricBase * randomBetween(.83,1.13) * factor),
    water: Math.round(zone.waterBase * randomBetween(.82,1.14) * factor),
    time: new Date().toISOString()
  };
}
function createInitialState(){
  const zones = LOCATIONS.map(z => ({...z, reading:makeReading(z), history:[]}));
  zones.forEach(z => {
    for(let d=6;d>=0;d--){
      const sampleTime=new Date(Date.now()-d*86400000);
      z.history.push({label:sampleTime.toLocaleDateString("en-IN",{weekday:"short"}),timestamp:sampleTime.toISOString(),electricity:Math.round(z.electricBase*randomBetween(.88,1.09)),water:Math.round(z.waterBase*randomBetween(.88,1.09))});
    }
    z.history[6] = {label:"Today",timestamp:z.reading.time,electricity:z.reading.electricity,water:z.reading.water};
  });
  return {zones,alerts:[],updatedAt:new Date().toISOString(),readingCount:1};
}
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function loadState(){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){
      const parsed=JSON.parse(saved);
      if(parsed && Array.isArray(parsed.zones) && parsed.zones.length===LOCATIONS.length && Array.isArray(parsed.alerts)) return parsed;
    }
  }catch(error){ console.warn("Could not load saved EcoGuard data:",error); }
  state=createInitialState(); saveState(); return state;
}
function getStatus(zone){
  const e=zone.reading.electricity/zone.electricBase;
  const w=zone.reading.water/zone.waterBase;
  const ratio=Math.max(e,w);
  return ratio>=1.45?"critical":ratio>=1.2?"warning":"normal";
}
function simulateCorrection(zoneId) {
  const zone = state.zones.find(z => z.id === zoneId);

  if (!zone) return;

  // Bring consumption back within normal limits
  zone.reading.electricity = Math.round(zone.electricBase * 0.9);
  zone.reading.water = Math.round(zone.waterBase * 0.9);

  // Save updated readings
  saveState();

  // Refresh the application
  renderDashboard();
  renderMonitoring();
  renderAlerts();

  showToast("Corrective action completed. Consumption is back to normal.");
}
function priorityFor(ratio){return ratio>=1.6?"high":ratio>=1.3?"medium":"low";}
function detectAnomalies(zone){
  // Adaptive statistical scans are handled by the feature module below.
  // Do not generate alerts from the old fixed 20% threshold.
}

function fmt(value){return Number(value).toLocaleString("en-IN");}
function timeText(iso){return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});}
function dateText(iso){return new Date(iso).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}
function showToast(message){
  const el=$("toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function totals(){
  return state.zones.reduce((a,z)=>({electricity:a.electricity+z.reading.electricity,water:a.water+z.reading.water,waste:a.waste+Math.max(0,z.reading.electricity-z.electricBase)+Math.max(0,(z.reading.water-z.waterBase)/100)}),{electricity:0,water:0,waste:0});
}
function efficiencyScore(){
  const ratios=state.zones.map(z=>Math.max(z.reading.electricity/z.electricBase,z.reading.water/z.waterBase));
  const average=ratios.reduce((a,b)=>a+b,0)/ratios.length;
  return Math.max(0,Math.min(100,Math.round(100-(Math.max(0,average-1)*100))));
}
function renderDashboard(){
  const t=totals(),score=efficiencyScore(),active=state.alerts.filter(a=>a.status==="active").length;
  $("totalElectricity").innerHTML=`${fmt(t.electricity)} <small>kWh</small>`;
  $("totalWater").innerHTML=`${fmt(t.water)} <small>L</small>`;
  $("totalWaste").innerHTML=`${fmt(Math.round(t.waste))} <small>est. units</small>`;
  $("activeAlerts").textContent=active;
  $("navAlertCount").textContent=active;$("navAlertCount").style.display=active?"inline-block":"none";
  $("efficiencyScore").textContent=score;
  $("efficiencyLabel").textContent=score>=90?"Excellent efficiency":score>=75?"Good performance":score>=55?"Needs attention":"High wastage detected";
  $("scoreRing").style.background=`conic-gradient(var(--green) ${score*3.6}deg,#e9eef2 ${score*3.6}deg)`;
  $("zoneCount").textContent=state.zones.length;$("lastUpdated").textContent=timeText(state.updatedAt);
  $("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short",year:"numeric"});
  $("overviewZones").innerHTML=state.zones.map(z=>`<tr><td>${z.name}</td><td>${fmt(z.reading.electricity)} kWh</td><td>${fmt(z.reading.water)} L</td><td><span class="status-pill status-${getStatus(z)}">${getStatus(z)}</span></td></tr>`).join("");
  renderCharts();
}
function renderCharts(){
  if(typeof Chart==="undefined")return;
  const labels=state.zones[0].history.map(h=>h.label);
  const daily=labels.map((label,i)=>state.zones.reduce((sum,z)=>sum+z.history[i].electricity,0));
  const water=labels.map((label,i)=>state.zones.reduce((sum,z)=>sum+z.history[i].water,0));
  const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{usePointStyle:true,boxWidth:7,font:{family:"DM Sans",size:10},color:"#718096"}}},scales:{x:{grid:{display:false},ticks:{color:"#98a3b2",font:{size:9}}},y:{grid:{color:"#eef1f4"},ticks:{color:"#98a3b2",font:{size:9}}}}};
  if(trendChart)trendChart.destroy();
  trendChart=new Chart($("trendChart"),{type:"line",data:{labels,datasets:[{label:"Electricity (kWh)",data:daily,borderColor:"#477bd0",backgroundColor:"#477bd022",fill:true,tension:.35,pointRadius:3},{label:"Water (L)",data:water,borderColor:"#25b783",backgroundColor:"#25b78318",fill:true,tension:.35,pointRadius:3,yAxisID:"y1"}]},options:{...common,scales:{...common.scales,y:{...common.scales.y,position:"left"},y1:{position:"right",grid:{drawOnChartArea:false},ticks:{color:"#98a3b2",font:{size:9}}}}}});
  if(compareChart)compareChart.destroy();
  compareChart=new Chart($("compareChart"),{type:"bar",data:{labels:state.zones.map(z=>z.name.replace("Hostel ","H. ")),datasets:[{label:"Electricity (kWh)",data:state.zones.map(z=>z.reading.electricity),backgroundColor:"#477bd0",borderRadius:4},{label:"Water (÷10 L)",data:state.zones.map(z=>Math.round(z.reading.water/10)),backgroundColor:"#25b783",borderRadius:4}]},options:{...common,plugins:{...common.plugins,legend:{...common.plugins.legend,position:"bottom"}},scales:{...common.scales,x:{...common.scales.x,ticks:{...common.scales.x.ticks,maxRotation:0}}}}});
}
function renderMonitoring(){
  $("zoneList").innerHTML=state.zones.map(z=>`<button class="zone-item ${selectedZone===z.id?"selected":""}" data-zone="${z.id}"><span><strong>${z.name}</strong><small>${z.type}</small></span><span class="mini-status" style="color:${getStatus(z)==="normal"?"#26966d":getStatus(z)==="warning"?"#c78a2c":"#d4545a"}">${getStatus(z)}</span></button>`).join("");
  document.querySelectorAll("[data-zone]").forEach(btn=>btn.addEventListener("click",()=>{selectedZone=btn.dataset.zone;renderMonitoring();}));
  const z=state.zones.find(x=>x.id===selectedZone)||state.zones[0];
  $("selectedZoneName").textContent=z.name;$("selectedZoneType").textContent=z.type;
  $("selectedStatus").textContent=getStatus(z);$("selectedStatus").className=`status-pill status-${getStatus(z)}`;
  $("selectedElectricity").textContent=fmt(z.reading.electricity);$("selectedWater").textContent=fmt(z.reading.water);
  $("electricBaseline").textContent=`${fmt(z.electricBase)} kWh`; $("waterBaseline").textContent=`${fmt(z.waterBase)} L`;
  if(typeof Chart!=="undefined"){
    if(zoneChart)zoneChart.destroy();
    zoneChart=new Chart($("zoneChart"),{type:"line",data:{labels:z.history.map(h=>h.label),datasets:[{label:"Electricity (kWh)",data:z.history.map(h=>h.electricity),borderColor:"#477bd0",tension:.3,pointRadius:3},{label:"Water (L)",data:z.history.map(h=>h.water),borderColor:"#25b783",tension:.3,pointRadius:3,yAxisID:"y1"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{usePointStyle:true,boxWidth:7,font:{size:10}}}},scales:{x:{grid:{display:false}},y:{grid:{color:"#eef1f4"}},y1:{position:"right",grid:{drawOnChartArea:false}}}}});
  }
}
function renderAlerts(){
  const priority=$("alertFilter").value,filter=$("alertStateFilter").value;
  let list=state.alerts.filter(a=>(priority==="all"||a.priority===priority)&&(filter==="all"||a.status===filter));
  $("alertSummary").textContent=`${state.alerts.filter(a=>a.status==="active").length} active alerts`;
  $("alertList").innerHTML=list.length?list.map(a=>`<article class="alert-card"><div class="alert-symbol ${a.priority}">${a.kind==="water"?"♒":"ϟ"}</div><div class="alert-main"><h3>${a.resource} usage anomaly — ${a.zoneName}</h3><p>${a.message} Reading: <strong>${fmt(a.value)} ${a.unit}</strong> vs baseline ${fmt(a.baseline)} ${a.unit} (${Math.round((a.ratio-1)*100)}% above baseline). This is a possible issue, not a confirmed leak.</p><div class="alert-meta">${dateText(a.createdAt)} · ${a.status==="resolved"?"Resolved":"Awaiting review"}</div>${a.status==="active"?`<button class="resolve-btn" data-resolve="${a.id}">✓ Mark as resolved</button>`:`<div class="resolved-label">✓ Marked resolved</div>`}</div><span class="priority ${a.priority}">${a.priority} priority</span></article>`).join(""):`<div class="empty-state">${filter==="active"?"No active alerts. Your monitored zones look good.":"No alerts match this filter."}</div>`;
  document.querySelectorAll("[data-resolve]").forEach(btn=>btn.addEventListener("click",()=>resolveAlert(btn.dataset.resolve)));
}
function renderRecommendations(){
  const recs=[];
  state.zones.forEach(z=>{
    const e=z.reading.electricity/z.electricBase,w=z.reading.water/z.waterBase;
    if(e>=1.2)recs.push({icon:"ϟ",title:`Review electricity use in ${z.name}`,body:"Inspect lights, fans, air-conditioning schedules and equipment left in standby. Compare usage again after switching off non-essential loads.",saving:`Illustrative excess: ${fmt(Math.round(z.reading.electricity-z.electricBase))} kWh`});
    if(w>=1.2)recs.push({icon:"♒",title:`Inspect water fixtures in ${z.name}`,body:"Check taps, flush valves, overhead tank overflow and visible plumbing. A maintenance inspection is needed to confirm any leak.",saving:`Illustrative excess: ${fmt(Math.round(z.reading.water-z.waterBase))} L`});
  });
  if(!recs.length)recs.push({icon:"✳",title:"Maintain current resource habits",body:"All zones are currently within the configured normal range. Continue scheduled inspections and compare usage at similar times each day.",saving:"No unusual excess detected"});
  $("recommendationList").innerHTML=recs.map(r=>`<article class="recommend-card"><div class="rec-icon">${r.icon}</div><h3>${r.title}</h3><p>${r.body}</p><span class="saving">${r.saving}</span></article>`).join("");
}
function renderAll(){renderDashboard();renderMonitoring();renderAlerts();renderRecommendations();}
function simulateReadings(){
  state.readingCount++;
  state.zones.forEach(z=>{
    // Most readings stay near baseline; occasional spikes demonstrate anomaly detection.
    const spike=Math.random()<.23;
    const factor=spike?randomBetween(1.28,1.85):1;
    z.reading=makeReading(z,factor);
    z.history.push({label:"Now",timestamp:z.reading.time,electricity:z.reading.electricity,water:z.reading.water});
    if(z.history.length>30)z.history.shift();
    detectAnomalies(z);
  });
  state.updatedAt=new Date().toISOString();saveState();renderAll();
  const newCount=state.alerts.filter(a=>a.status==="active"&&a.readingCount===state.readingCount).length;
  showToast(newCount?`${newCount} new anomaly alert${newCount===1?"":"s"} generated.`:"New readings received. No thresholds crossed.");
}
function resolveAlert(id){
  const alert=state.alerts.find(a=>a.id===id);
  if(alert){alert.status="resolved";saveState();renderAlerts();renderDashboard();showToast("Alert marked as resolved.");}
}
function resetDemo(){
  if(!confirm("Reset all EcoGuard demo readings and alerts to the original sample data?"))return;
  localStorage.removeItem(STORAGE_KEY);localStorage.removeItem("ecoguard-feature-data-v1");state=createInitialState();selectedZone="science";saveState();renderAll();window.dispatchEvent(new Event("ecoguard-reset"));showToast("Demo data has been reset.");
}
function navigate(section){
  document.querySelectorAll(".page-section").forEach(s=>s.classList.toggle("active",s.id===section));
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
  const names={dashboard:"Overview",monitoring:"Live monitoring",alerts:"Alert center",recommendations:"Recommendations",about:"About EcoGuard"};
  $("pageTitle").textContent=names[section]||"Overview";
  $("sidebar").classList.remove("open");
  // Charts need a visible canvas size when their section becomes active.
  if(section==="monitoring")renderMonitoring();
}
function init(){
  state=loadState();
  // Validate persisted zone shape; restore clean demo if the browser contains an older/incompatible version.
  if(!state.zones.every(z=>z.reading&&Array.isArray(z.history))){state=createInitialState();saveState();}
  document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.section)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
  $("simulateBtn").addEventListener("click",simulateReadings);$("monitorSimulate").addEventListener("click",simulateReadings);
  $("resetBtn").addEventListener("click",resetDemo);
  $("alertFilter").addEventListener("change",renderAlerts);$("alertStateFilter").addEventListener("change",renderAlerts);
  $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  renderAll();
}
document.addEventListener("DOMContentLoaded",init);


/* ================================================================
   ECOGUARD SMART CAMPUS INTELLIGENCE – ADDED FEATURES
   Combined into this file so all JavaScript is in one place.
   ================================================================ */

/* ECOGUARD SMART CAMPUS INTELLIGENCE - feature extension
   Runs on top of the existing script.js state. All data is simulated and stored locally. */
"use strict";

(() => {
  const FEATURE_STORAGE = "ecoguard-feature-data-v1";
  const GRID_FACTOR = 0.675; // kg CO2 per kWh; CEA India national weighted average, FY 2025-26
  const $f = id => document.getElementById(id);
  let featureData = { tickets: [], challengeJoined: false, completedActions: [], inspectionFeedback: {} };
  let rankMode = "blocks";

  const fmtF = n => Math.round(n).toLocaleString("en-IN");
  const pct = n => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  const safeText = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  function loadFeatureData() {
    try {
      const saved = JSON.parse(localStorage.getItem(FEATURE_STORAGE) || "null");
      if (saved && Array.isArray(saved.tickets)) featureData = { ...featureData, ...saved, inspectionFeedback: saved.inspectionFeedback || {} };
    } catch (e) { console.warn("Feature demo data could not be loaded", e); }
  }
  function saveFeatureData() { localStorage.setItem(FEATURE_STORAGE, JSON.stringify(featureData)); }
  function totalsF() {
    return state.zones.reduce((a,z) => {
      a.electricity += z.reading.electricity;
      a.water += z.reading.water;
      a.excessElectricity += Math.max(0, z.reading.electricity - z.electricBase);
      a.excessWater += Math.max(0, z.reading.water - z.waterBase);
      return a;
    }, { electricity:0, water:0, excessElectricity:0, excessWater:0 });
  }
  function ecoScore() {
    const ratios = state.zones.map(z => Math.max(z.reading.electricity/z.electricBase, z.reading.water/z.waterBase));
    const avg = ratios.reduce((a,b)=>a+b,0) / (ratios.length || 1);
    return Math.max(0, Math.min(100, Math.round(100 - Math.max(0, avg-1)*100)));
  }

  // 1. Carbon footprint
  function renderCarbon() {
    const t = totalsF(), reduction = Number($f("carbonReduction").value || 30) / 100;
    const co2 = t.electricity * GRID_FACTOR;
    const co2Saved = t.excessElectricity * GRID_FACTOR * reduction;
    const waterSaved = t.excessWater * reduction;
    $f("carbonEmissions").innerHTML = `${fmtF(co2)} <small>kg CO₂</small>`;
    $f("waterWastage").innerHTML = `${fmtF(t.excessWater)} <small>litres</small>`;
    $f("carbonAvoided").innerHTML = `${fmtF(t.excessElectricity * GRID_FACTOR)} <small>kg</small>`;
    $f("monthlyEcoScore").innerHTML = `${ecoScore()} <small>/100</small>`;
    $f("carbonFormula").textContent = `${fmtF(t.electricity)} kWh × ${GRID_FACTOR} = ${fmtF(co2)} kg CO₂`;
    $f("carbonReductionLabel").textContent = `${Math.round(reduction*100)}%`;
    $f("simCarbonSaved").textContent = `${fmtF(co2Saved)} kg`;
    $f("simWaterSaved").textContent = `${fmtF(waterSaved)} L`;
  }

  // 2. Team leaderboard: block-vs-block and stream-vs-stream only.
  const streamMap = {
    "Computer Science & Engineering": ["science", "library"],
    "Electronics & Communication": ["admin"],
    "Mechanical Engineering": ["hostel-a"],
    "Civil Engineering": ["hostel-b"]
  };
  function pointsFor(zones) {
    const ratio = zones.reduce((sum,z)=>sum + ((z.reading.electricity/z.electricBase + z.reading.water/z.waterBase)/2),0) / zones.length;
    const improvement = Math.max(0, 1.15-ratio);
    const score = Math.max(0, Math.round(500 + improvement*1000 - Math.max(0,ratio-1)*350));
    return score + featureData.completedActions.filter(a=>zones.some(z=>z.id===a.zoneId)).length*25;
  }
  function renderLeaderboard() {
    let teams;
    if (rankMode === "blocks") {
      teams = state.zones.map(z => ({name:z.name, detail:z.type, zones:[z]}));
      $f("leaderboardHeading").textContent = "Block sustainability rankings";
      $f("challengeTitle").textContent = "Power Down 10%";
      $f("challengeDescription").textContent = "Each campus block works together to reduce electricity consumption by 10% compared with its baseline.";
    } else {
      teams = Object.entries(streamMap).map(([name, ids]) => ({name, detail:"Academic stream team", zones:state.zones.filter(z=>ids.includes(z.id))})).filter(t=>t.zones.length);
      $f("leaderboardHeading").textContent = "Stream sustainability rankings";
      $f("challengeTitle").textContent = "Green Stream Challenge";
      $f("challengeDescription").textContent = "Academic streams compete as teams to improve electricity and water efficiency across their assigned campus areas.";
    }
    teams = teams.map(t=>({...t,points:pointsFor(t.zones),ratio:t.zones.reduce((s,z)=>s+(z.reading.electricity/z.electricBase+z.reading.water/z.waterBase)/2,0)/t.zones.length}))
      .sort((a,b)=>b.points-a.points);
    const max = Math.max(1,...teams.map(t=>t.points));
    $f("leaderboardList").innerHTML = teams.map((t,i)=>`
      <div class="leaderboard-row">
        <span class="rank-number">${i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
        <div class="rank-main"><div class="rank-title"><b>${safeText(t.name)}</b><span>${fmtF(t.points)} eco-points</span></div><div class="rank-track"><span style="width:${Math.max(4,t.points/max*100)}%"></span></div><small>${safeText(t.detail)} · ${Math.round(Math.max(0,1.2-t.ratio)*100)}% efficiency headroom</small></div>
      </div>`).join("");
    const joined = featureData.challengeJoined;
    $f("joinChallenge").textContent = joined ? "✓ Team joined challenge" : "Join this challenge";
    $f("joinChallenge").disabled = joined;
    const progress = Math.min(100, Math.max(0, Math.round(teams.reduce((s,t)=>s+Math.max(0,1.1-t.ratio),0)/teams.length*500)));
    $f("challengeProgressText").textContent = `${progress}%`;
    $f("challengeProgressBar").style.width = `${progress}%`;
  }

  // 3. Linear regression on last seven daily values, forecast next 30 days.
  function linearForecast(values) {
    const n = values.length;
    if (n < 2) return {monthly: (values[0] || 0)*30, change:0, slope:0};
    const xs = values.map((_,i)=>i);
    const mx = xs.reduce((a,b)=>a+b,0)/n, my=values.reduce((a,b)=>a+b,0)/n;
    const numerator=xs.reduce((s,x,i)=>s+(x-mx)*(values[i]-my),0);
    const denominator=xs.reduce((s,x)=>s+(x-mx)**2,0) || 1;
    const slope=numerator/denominator, intercept=my-slope*mx;
    const projected=Array.from({length:30},(_,i)=>Math.max(0,intercept+slope*(n+i)));
    const monthly=projected.reduce((a,b)=>a+b,0);
    const baseline=my*30;
    return {monthly,change:baseline ? (monthly-baseline)/baseline*100 : 0,slope,baseline};
  }
  function renderPrediction() {
    const electric = state.zones.map(z=>linearForecast(z.history.map(h=>h.electricity)));
    const water = state.zones.map(z=>linearForecast(z.history.map(h=>h.water)));
    const eTotal=electric.reduce((s,x)=>s+x.monthly,0), wTotal=water.reduce((s,x)=>s+x.monthly,0);
    const eBase=state.zones.reduce((s,z)=>s+z.electricBase,0)*30;
    const wBase=state.zones.reduce((s,z)=>s+z.waterBase,0)*30;
    const eChange=eBase?(eTotal-eBase)/eBase*100:0, wChange=wBase?(wTotal-wBase)/wBase*100:0;
    $f("predictedElectricity").textContent = `${fmtF(eTotal)} kWh`;
    $f("predictedWater").textContent = `${fmtF(wTotal)} L`;
    $f("electricPredictionText").textContent = `${pct(eChange)} compared with 30-day baseline run-rate (${fmtF(eBase)} kWh).`;
    $f("waterPredictionText").textContent = `${pct(wChange)} compared with 30-day baseline run-rate (${fmtF(wBase)} L).`;
    $f("electricPredictionAction").textContent = eChange>5 ? "Suggested action: review AC schedules, lighting timers and after-hours equipment in the highest-use blocks." : "Suggested action: maintain current schedules and keep checking after-hours loads.";
    $f("waterPredictionAction").textContent = wChange>5 ? "Suggested action: inspect tanks, flush valves and taps; compare night-time flow for possible leaks." : "Suggested action: continue routine plumbing checks and monitor daily consumption.";
    $f("predictionBreakdown").innerHTML = `<div><b>Model</b><span>Least-squares linear trend over the latest ${state.zones[0].history.length} readings per zone</span></div><div><b>Electricity trend</b><span>${eChange>=0?"Increasing":"Decreasing"} by ${Math.abs(eChange).toFixed(1)}% vs baseline run-rate</span></div><div><b>Water trend</b><span>${wChange>=0?"Increasing":"Decreasing"} by ${Math.abs(wChange).toFixed(1)}% vs baseline run-rate</span></div>`;
  }

  // 4. Adaptive statistical anomaly detection.
  function stats(values) {
    const mean=values.reduce((a,b)=>a+b,0)/(values.length||1);
    const variance=values.reduce((sum,x)=>sum+(x-mean)**2,0)/(values.length||1);
    return {mean,sd:Math.sqrt(variance)};
  }
  function feedbackKey(zoneId,kind){return `${zoneId}:${kind}`;}
  function adaptiveZLimit(zoneId,kind){
    const feedback=featureData.inspectionFeedback[feedbackKey(zoneId,kind)] || {confirmed:0,falseAlarm:0};
    // Confirmed faults make the detector more responsive; no-fault inspections make it more conservative.
    return Math.max(2.0,Math.min(3.0,2.5-(feedback.confirmed||0)*0.1+(feedback.falseAlarm||0)*0.15));
  }
  function getAdaptiveBaseline(zone,kind){
    const now=new Date(zone.reading.time || Date.now());
    const previous=zone.history.slice(0,-1).filter(h=>Number.isFinite(h[kind]));
    const sameHour=previous.filter(h=>h.timestamp && new Date(h.timestamp).getHours()===now.getHours());
    // Prefer comparable hours when there are enough samples; otherwise use all recent history.
    const samples=sameHour.length>=4?sameHour:previous;
    const values=samples.map(h=>h[kind]);
    const result=stats(values);
    return {...result,count:values.length,scope:sameHour.length>=4?`same hour (${sameHour.length} samples)`:`recent history (${values.length} samples)`};
  }
  function getAnomalies() {
    const found=[];
    state.zones.forEach(z=>{
      ["electricity","water"].forEach(kind=>{
        const value=z.reading[kind];
        const baseline=getAdaptiveBaseline(z,kind);
        if(baseline.count<4)return; // Avoid confident alerts with too little history.
        const zScore=baseline.sd>0?(value-baseline.mean)/baseline.sd:(value>baseline.mean?99:0);
        const limit=adaptiveZLimit(z.id,kind);
        const relativeRise=baseline.mean>0?(value-baseline.mean)/baseline.mean:0;
        // Require a statistical deviation and a modest practical increase; no fixed configured baseline trigger.
        if(zScore>=limit && relativeRise>=0.08){
          found.push({zone:z,kind,value,base:baseline.mean,mean:baseline.mean,sd:baseline.sd,zScore,limit,relativeRise,sampleCount:baseline.count,scope:baseline.scope});
        }
      });
    });
    return found.sort((a,b)=>b.zScore-a.zScore);
  }
  function syncAdaptiveAlerts(list){
    let changed=false;
    list.forEach(a=>{
      const duplicate=state.alerts.find(alert=>alert.zoneId===a.zone.id&&alert.kind===a.kind&&alert.readingCount===state.readingCount);
      if(duplicate)return;
      const ratio=a.mean>0?a.value/a.mean:1;
      state.alerts.unshift({id:`adaptive-${Date.now()}-${a.zone.id}-${a.kind}`,zoneId:a.zone.id,zoneName:a.zone.name,resource:a.kind==="electricity"?"Electricity":"Water",value:a.value,baseline:a.mean,unit:a.kind==="electricity"?"kWh":"L",ratio,priority:a.zScore>=3.5?"high":a.zScore>=3?"medium":"low",message:`Reading is ${a.zScore.toFixed(2)} standard deviations above its adaptive historical average (${a.scope}).`,createdAt:new Date().toISOString(),status:"active",kind:a.kind,readingCount:state.readingCount,method:"adaptive"});
      changed=true;
    });
    if(changed&&typeof saveState==="function"){saveState();if(typeof renderDashboard==="function")renderDashboard();if(typeof renderAlerts==="function")renderAlerts();}
  }
  function renderAnomalies() {
    const list=getAnomalies();
    syncAdaptiveAlerts(list);
    $f("anomalyResults").innerHTML = list.length ? list.map(a=>{
      const resource=a.kind==="electricity"?"Electricity":"Water";
      const unit=a.kind==="electricity"?"kWh":"L";
      const already=featureData.tickets.some(t=>t.zoneId===a.zone.id && t.resource===resource && t.status==="Open");
      const priority=a.zScore>=3.5?"critical":"warning";
      return `<article class="anomaly-card"><div class="anomaly-head"><div><b>${safeText(a.zone.name)} · ${resource}</b><small>${fmtF(a.value)} ${unit} current reading vs adaptive average ${fmtF(a.mean)} ${unit}</small></div><span class="status-pill status-${priority}">${a.zScore.toFixed(2)}σ deviation</span></div><div class="anomaly-stats"><span>Historical average: <b>${fmtF(a.mean)}</b></span><span>Standard deviation: <b>${fmtF(a.sd)}</b></span><span>Alert limit: <b>${a.limit.toFixed(2)}σ</b></span><span>Baseline: <b>${safeText(a.scope)}</b></span></div><p>${a.kind==="electricity"?"Possible causes: AC schedules, lighting or equipment left on.":"Possible causes: leaking taps, flush valves, tank overflow or unusual cleaning demand."} This is a statistical signal, not a confirmed fault.</p><div class="dispatch-row"><label>Assign maintenance team<select data-anomaly-assignee="${a.zone.id}-${a.kind}"><option>Facilities team</option><option>Electrical maintenance team</option><option>Plumbing maintenance team</option></select></label><button class="secondary-btn" data-dispatch-zone="${a.zone.id}" data-dispatch-resource="${resource}" ${already?"disabled":""}>${already?"Open ticket already exists":"Dispatch maintenance ticket"}</button></div></article>`;
    }).join("") : `<div class="empty-state">No adaptive statistical anomalies detected. The detector compares readings with recent historical patterns and similar hours where enough samples exist.</div>`;
    document.querySelectorAll("[data-dispatch-zone]").forEach(btn=>btn.addEventListener("click",()=>{
      const zoneId=btn.dataset.dispatchZone,resource=btn.dataset.dispatchResource;
      const key=`${zoneId}-${resource.toLowerCase()==="electricity"?"electricity":"water"}`;
      const assign=$f("anomalyResults").querySelector(`[data-anomaly-assignee="${key}"]`);
      const zone=state.zones.find(z=>z.id===zoneId);
      createTicket(zoneId,resource,assign?assign.value:"Facilities team",`Adaptive anomaly detected for ${resource.toLowerCase()} usage. Inspect the equipment/fixtures and record the actual inspection outcome.`);
      navigate("maintenance");
    }));
  }

  // 5. Assigned maintenance tickets with recorded inspection outcomes and feedback.
  function populateTicketZones() {
    $f("ticketZone").innerHTML=state.zones.map(z=>`<option value="${z.id}">${safeText(z.name)}</option>`).join("");
  }
  function createTicket(zoneId,resource,assignee,description) {
    const z=state.zones.find(x=>x.id===zoneId); if(!z) return;
    featureData.tickets.unshift({
      id:`EG-${Date.now().toString().slice(-6)}`,zoneId,zoneName:z.name,resource,assignee,description,
      beforeElectricity:z.reading.electricity,beforeWater:z.reading.water,
      status:"Open",createdAt:new Date().toISOString(),completedAt:null,inspectionOutcome:null,inspectionNotes:"",savedElectricity:0,savedWater:0
    });
    saveFeatureData(); renderTickets(); showToast("Maintenance ticket dispatched to "+assignee+".");
  }
  function renderTickets() {
    $f("ticketCount").textContent=`${featureData.tickets.length} TICKETS`;
    $f("ticketList").innerHTML=featureData.tickets.length ? featureData.tickets.map(t=>`
      <article class="ticket-card"><div class="ticket-top"><div><span class="ticket-id">${safeText(t.id)}</span><h3>${safeText(t.zoneName)} · ${safeText(t.resource)}</h3></div><span class="ticket-status ${t.status==="Open"?"open":"done"}">${safeText(t.status)}</span></div><p>${safeText(t.description)}</p><div class="ticket-meta">Assigned to: <b>${safeText(t.assignee)}</b> · Created ${new Date(t.createdAt).toLocaleString("en-IN")}</div>${t.status==="Open"?`<form class="inspection-form" data-inspection-form="${safeText(t.id)}"><label>Inspection outcome<select name="outcome" required><option value="">Select actual finding</option><option value="confirmed_leak">Confirmed water leak</option><option value="unattended_device">Unattended device/equipment</option><option value="no_fault">No fault found (false alarm)</option><option value="other">Other issue / maintenance required</option></select></label><label>Inspection notes<textarea name="notes" rows="2" placeholder="What did the technician inspect and find?" required></textarea></label><button class="primary-btn" type="submit">Save inspection & verify</button></form>`:`<div class="verified-line">✓ Inspection recorded: <b>${safeText(t.outcomeLabel||t.inspectionOutcome||"Verified")}</b><br>${safeText(t.inspectionNotes||"")}<br><small>${t.inspectionAt?new Date(t.inspectionAt).toLocaleString("en-IN"):""}</small></div>`}</article>`).join("") : `<div class="empty-state">No maintenance tickets yet. Dispatch one from an anomaly or use the form above.</div>`;
    document.querySelectorAll("[data-inspection-form]").forEach(form=>form.addEventListener("submit",e=>{
      e.preventDefault();const data=new FormData(form);recordInspection(form.dataset.inspectionForm,data.get("outcome"),String(data.get("notes")||"").trim());
    }));
    const completed=featureData.tickets.filter(t=>t.status==="Verified");
    const eSaved=completed.reduce((sum,t)=>sum+t.savedElectricity,0),wSaved=completed.reduce((sum,t)=>sum+t.savedWater,0);
    $f("verifiedSavings").innerHTML=completed.length?`<div><small>Recorded electricity reduction (demo)</small><b>${fmtF(eSaved)} kWh</b></div><div><small>Recorded water reduction (demo)</small><b>${fmtF(wSaved)} L</b></div><div><small>Estimated CO₂ avoided</small><b>${fmtF(eSaved*GRID_FACTOR)} kg</b></div>`:"";
  }
  function recordInspection(id,outcome,notes){
    const ticket=featureData.tickets.find(t=>t.id===id&&t.status==="Open");if(!ticket||!outcome||!notes)return;
    const feedbackKinds=ticket.resource==="Electricity"?["electricity"]:ticket.resource==="Water"?["water"]:["electricity","water"];
    const confirmed=outcome!=="no_fault";
    feedbackKinds.forEach(kind=>{
      const key=feedbackKey(ticket.zoneId,kind);
      const feedback=featureData.inspectionFeedback[key]||{confirmed:0,falseAlarm:0};
      if(confirmed)feedback.confirmed=(feedback.confirmed||0)+1;else feedback.falseAlarm=(feedback.falseAlarm||0)+1;
      featureData.inspectionFeedback[key]=feedback;
    });
    const labels={confirmed_leak:"Confirmed water leak",unattended_device:"Unattended device/equipment",no_fault:"No fault found — false alarm",other:"Other maintenance issue"};
    ticket.status="Verified";ticket.inspectionOutcome=outcome;ticket.outcomeLabel=labels[outcome]||outcome;ticket.inspectionNotes=notes;ticket.inspectionAt=new Date().toISOString();ticket.completedAt=ticket.inspectionAt;
    state.alerts.filter(alert=>alert.zoneId===ticket.zoneId&&alert.status==="active"&&(ticket.resource==="General inspection"||alert.kind===(ticket.resource.toLowerCase()==="electricity"?"electricity":"water"))).forEach(alert=>{alert.status="resolved";alert.inspectionOutcome=ticket.outcomeLabel;});
    if(typeof saveState==="function")saveState();
    // Record measured reduction only when the demo's current reading is lower than the ticket's initial reading.
    const zone=state.zones.find(z=>z.id===ticket.zoneId);
    if(zone){ticket.savedElectricity=Math.max(0,ticket.beforeElectricity-zone.reading.electricity);ticket.savedWater=Math.max(0,ticket.beforeWater-zone.reading.water);}
    featureData.completedActions.push({zoneId:ticket.zoneId,ticketId:ticket.id,outcome,at:ticket.inspectionAt});
    saveFeatureData();renderTickets();renderAnomalies();showToast(`Inspection saved. Future alert sensitivity updated for ${ticket.resource}.`);
  }

  // 6. Rule-based campus assistant using current application state.
  function answerAssistant(question) {
    const q=question.toLowerCase(), t=totalsF();
    const byElectric=[...state.zones].sort((a,b)=>(b.reading.electricity/b.electricBase)-(a.reading.electricity/a.electricBase));
    const byWater=[...state.zones].sort((a,b)=>(b.reading.water/b.waterBase)-(a.reading.water/a.waterBase));
    const anomalies=getAnomalies();
    let answer="", checklist=[];
    if(q.includes("which") && (q.includes("electric")||q.includes("wast"))) {
      const z=byElectric[0], over=(z.reading.electricity/z.electricBase-1)*100;
      answer=`${z.name} currently has the highest electricity use relative to its baseline: ${fmtF(z.reading.electricity)} kWh against ${fmtF(z.electricBase)} kWh (${pct(over)}). This comparison uses the simulated readings currently stored in this browser.`;
      checklist=["Check AC operating hours and thermostat settings.","Inspect lights, fans and shared equipment after class hours.","Compare the next reading after the inspection."];
    } else if(q.includes("water")) {
      const z=byWater[0], over=(z.reading.water/z.waterBase-1)*100;
      answer=`${z.name} has the highest water use relative to its baseline: ${fmtF(z.reading.water)} L against ${fmtF(z.waterBase)} L (${pct(over)}). Campus-wide estimated excess is ${fmtF(t.excessWater)} L.`;
      checklist=["Inspect taps, flush valves and overhead tank overflow.","Check visible pipes and meters for continuous flow.","Record a follow-up reading after the repair."];
    } else if(q.includes("increase") || q.includes("week") || q.includes("trend")) {
      const z=byElectric[0], h=z.history.map(x=>x.electricity), first=h[0]||0, last=h[h.length-1]||0;
      const change=first?(last-first)/first*100:0;
      answer=`Across the current seven-reading sample, total campus electricity is ${fmtF(t.electricity)} kWh. ${z.name} is the highest relative to baseline. Its first-to-latest sample changed by ${pct(change)}. A spike may reflect AC demand, occupancy, lighting or equipment left running; the readings alone cannot identify the cause.`;
      checklist=["Compare the same time-of-day readings across the week.","Check occupancy, weather and AC operating schedules.","Inspect after-hours loads in the highest-use block."];
    } else if(q.includes("15") || q.includes("plan") || q.includes("reduce") || q.includes("save")) {
      answer=`A practical 15% electricity-reduction plan starts with the highest relative-use blocks. Current campus electricity is ${fmtF(t.electricity)} kWh in the latest simulated snapshot. Target reduction: about ${fmtF(t.electricity*.15)} kWh for a comparable period.`;
      checklist=["Days 1–2: record block-wise baselines and identify after-hours loads.","Days 3–5: adjust AC schedules and switch off unused lighting/equipment.","Week 2: inspect high-use equipment and raise maintenance tickets.","Week 3: compare like-for-like kWh readings and calculate actual reduction.","Week 4: award team eco-points only for verified reductions."];
    } else if(q.includes("anomal") || q.includes("alert")) {
      answer=`The statistical scan currently identifies ${anomalies.length} possible anomaly readings. These are based on baseline thresholds and recent-history deviation; they are not confirmed faults.`;
      checklist=anomalies.slice(0,4).map(a=>`Inspect ${a.zone.name} ${a.kind} reading (${fmtF(a.value)} vs ${fmtF(a.base)} baseline).`);
      if(!checklist.length)checklist=["Continue daily monitoring and investigate any sudden change."];
    } else {
      answer=`Here is the current campus snapshot: ${fmtF(t.electricity)} kWh electricity, ${fmtF(t.water)} L water, ${anomalies.length} statistical anomaly readings and an eco-score of ${ecoScore()}/100. Ask me which block uses the most electricity, how to reduce water, why a trend changed, or for a 15% reduction plan.`;
      checklist=["Review the Anomaly Intelligence page.","Check the Green Campus leaderboard for team participation.","Create maintenance tickets for issues requiring inspection."];
    }
    return {answer,checklist};
  }
  function addAssistantMessage(text,kind) {
    const div=document.createElement("div");div.className=kind==="user"?"user-message":"assistant-message";
    div.textContent=text;$f("assistantConversation").appendChild(div);
    $f("assistantConversation").scrollTop=$f("assistantConversation").scrollHeight;
  }
  function askAssistant(question) {
    if(!question.trim())return;
    addAssistantMessage(question,"user");
    const result=answerAssistant(question);
    const div=document.createElement("div");div.className="assistant-message";
    const p=document.createElement("p");p.textContent=result.answer;div.appendChild(p);
    const strong=document.createElement("b");strong.textContent="Action checklist";div.appendChild(strong);
    const ul=document.createElement("ul");result.checklist.forEach(item=>{const li=document.createElement("li");li.textContent=item;ul.appendChild(li);});div.appendChild(ul);
    $f("assistantConversation").appendChild(div);$f("assistantConversation").scrollTop=$f("assistantConversation").scrollHeight;
  }

  function refreshFeatures() {
    renderCarbon();renderLeaderboard();renderPrediction();renderAnomalies();renderTickets();
  }
  function initFeatures() {
    loadFeatureData();populateTicketZones();refreshFeatures();
    document.querySelectorAll(".nav-link[data-section]").forEach(btn=>{
      btn.addEventListener("click",()=>setTimeout(()=>{if(btn.dataset.section==="carbon")renderCarbon();if(btn.dataset.section==="leaderboard")renderLeaderboard();if(btn.dataset.section==="prediction")renderPrediction();if(btn.dataset.section==="anomalies")renderAnomalies();if(btn.dataset.section==="maintenance")renderTickets();},0));
    });
    $f("carbonReduction").addEventListener("input",renderCarbon);
    document.querySelectorAll("[data-rank-mode]").forEach(btn=>btn.addEventListener("click",()=>{
      rankMode=btn.dataset.rankMode;
      document.querySelectorAll("[data-rank-mode]").forEach(b=>b.classList.toggle("active",b===btn));
      renderLeaderboard();
    }));
    $f("joinChallenge").addEventListener("click",()=>{featureData.challengeJoined=true;saveFeatureData();renderLeaderboard();showToast("Your campus team joined the green challenge.");});
    $f("runAnomalyScan").addEventListener("click",()=>{renderAnomalies();showToast("Statistical anomaly scan completed.");});
    $f("ticketForm").addEventListener("submit",e=>{
      e.preventDefault();createTicket($f("ticketZone").value,$f("ticketResource").value,$f("ticketAssignee").value,$f("ticketDescription").value.trim());$f("ticketDescription").value="";
    });
    $f("assistantForm").addEventListener("submit",e=>{e.preventDefault();askAssistant($f("assistantQuestion").value);$f("assistantQuestion").value="";});
    document.querySelectorAll(".prompt-chip").forEach(btn=>btn.addEventListener("click",()=>askAssistant(btn.textContent)));
    window.addEventListener("ecoguard-reset",()=>{featureData={tickets:[],challengeJoined:false,completedActions:[],inspectionFeedback:{}};saveFeatureData();populateTicketZones();refreshFeatures();});
    // Existing simulation button updates global state; refresh all feature views afterward.
    ["simulateBtn","monitorSimulate"].forEach(id=>$f(id).addEventListener("click",()=>setTimeout(()=>{refreshFeatures();},50)));
  }
  document.addEventListener("DOMContentLoaded",initFeatures);
})();
