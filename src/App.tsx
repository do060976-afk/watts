import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

type Energy = 'electricity' | 'gas'
type Contract = {
  energy: Energy; supplier: string; offer: string; price: number; hpPrice: number; hcPrice: number;
  tempoMode?: boolean; tempoBlueHp?: number; tempoBlueHc?: number; tempoWhiteHp?: number; tempoWhiteHc?: number; tempoRedHp?: number; tempoRedHc?: number;
  subscription: number; power: string; gasCoefficient: number; hpHc: boolean; updated: string
}
type Appliance = { id: string; name: string; category: string; energy: Energy; watts: number; hours: number; days: number; note: string }
type Bill = { id: string; energy: Energy; date: string; amount: number; consumption: number; label: string; pdfId?: string; period?: string }
type MeterReading = { id:string; energy:Energy; meterId:string; date:string; index:number; unit:'kWh'|'m3'; coefficient?:number }
type AnnualReport = { id:string; energy:Energy; year:number; consumption:number; amount:number; period:string; source:string; pdfId?:string; details?:string }
type WaterBill = { id:string; date:string; period:string; consumption:number; unitPrice:number; label:string; pdfId?:string }
type Data = { contracts: Contract[]; appliances: Appliance[]; bills: Bill[]; meterReadings:MeterReading[]; annualReports:AnnualReport[]; waterBills:WaterBill[]; dark: boolean }
const STORAGE = 'watts-data-v1'
const euro = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const uid = () => Math.random().toString(36).slice(2, 10)
const defaultData: Data = {
  contracts: [
    { energy: 'electricity', supplier: '', offer: '', price: 0.20, hpPrice: 0.22, hcPrice: 0.17, tempoMode: false, tempoBlueHp: 0.1654, tempoBlueHc: 0.1356, tempoWhiteHp: 0.1921, tempoWhiteHc: 0.1536, tempoRedHp: 0.7295, tempoRedHc: 0.1615, subscription: 15, power: '6 kVA', gasCoefficient: 11.2, hpHc: false, updated: '' },
    { energy: 'gas', supplier: '', offer: '', price: 0.12, hpPrice: 0.12, hcPrice: 0.12, subscription: 25, power: '', gasCoefficient: 11.2, hpHc: false, updated: '' },
  ],
  appliances: [
    { id: uid(), name: 'Radiateur électrique', category: 'Chauffage', energy: 'electricity', watts: 2000, hours: 5, days: 30, note: 'Puissance nominale ; le thermostat peut réduire le temps de chauffe réel.' },
    { id: uid(), name: 'Réfrigérateur', category: 'Cuisine', energy: 'electricity', watts: 80, hours: 8, days: 30, note: 'Puissance moyenne simplifiée : un réfrigérateur fonctionne par cycles.' },
    { id: uid(), name: 'Lave-linge', category: 'Linge', energy: 'electricity', watts: 2000, hours: 1, days: 12, note: 'La puissance de chauffe est ponctuelle ; mieux vaut utiliser les kWh/cycle si connus.' },
    { id: uid(), name: 'Sèche-linge', category: 'Linge', energy: 'electricity', watts: 2500, hours: 1.5, days: 8, note: 'Valeur indicative, très variable selon le modèle.' },
    { id: uid(), name: 'Télévision', category: 'Multimédia', energy: 'electricity', watts: 100, hours: 4, days: 30, note: 'Consommation indicative.' },
    { id: uid(), name: 'Ordinateur', category: 'Multimédia', energy: 'electricity', watts: 150, hours: 5, days: 22, note: 'Dépend fortement du matériel et de l’usage.' },
    { id: uid(), name: 'Four électrique', category: 'Cuisine', energy: 'electricity', watts: 2200, hours: 1, days: 12, note: 'La résistance ne chauffe pas en continu à pleine puissance.' },
    { id: uid(), name: 'Box Internet', category: 'Multimédia', energy: 'electricity', watts: 12, hours: 24, days: 30, note: 'Fonctionne généralement en continu.' },
    { id: uid(), name: 'Chauffe-eau électrique', category: 'Eau chaude', energy: 'electricity', watts: 2000, hours: 3, days: 30, note: 'Durée équivalente de chauffe estimative.' },
    { id: uid(), name: 'Plaque de cuisson', category: 'Cuisine', energy: 'electricity', watts: 1800, hours: 1, days: 30, note: 'Puissance moyenne simplifiée.' },
    { id: uid(), name: 'Chaudière gaz', category: 'Chauffage', energy: 'gas', watts: 10000, hours: 3, days: 30, note: 'Puissance thermique indicative en watts ; approximation de durée à adapter.' },
    { id: uid(), name: 'Cuisson au gaz', category: 'Cuisine', energy: 'gas', watts: 2000, hours: 1, days: 20, note: 'Puissance thermique indicative, selon brûleur et réglage.' },
  ],
  bills: [], meterReadings: [], annualReports: [], waterBills: [], dark: false,
}
const INITIAL_WATER:WaterBill[]=( [
      ['2020-09-09','Avril–septembre 2020',102],['2021-04-21','Octobre 2020–mars 2021',80],['2021-09-10','Avril–septembre 2021',79],['2022-03-18','Octobre 2021–mars 2022',68],['2022-10-07','Avril–septembre 2022',66],['2023-05-10','Octobre 2022–mars 2023',77],['2023-10-10','Avril–septembre 2023',65],['2024-03-18','Octobre 2023–mars 2024',73],['2024-09-03','Avril–septembre 2024',55],['2025-04-17','Octobre 2024–mars 2025',84],['2025-09-01','Avril–septembre 2025',45],['2026-03-13','Octobre 2025–mars 2026',66],['2026-09-07','Avril–septembre 2026',78]
    ] as [string,string,number][]).map(([date,period,consumption])=>({id:`water-${date}`,date:String(date),period:String(period),consumption:Number(consumption),unitPrice:0.0077,label:'Facture Veolia'}))
const loadData = (): Data => {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return { ...defaultData, waterBills: INITIAL_WATER }
    const parsed = JSON.parse(raw) as Partial<Data>
    return { ...defaultData, ...parsed, contracts: parsed.contracts?.length ? parsed.contracts.map(c => ({ ...defaultData.contracts.find(x => x.energy === c.energy), ...c })) as Contract[] : defaultData.contracts, appliances: parsed.appliances?.length ? parsed.appliances : defaultData.appliances, bills: parsed.bills || [], meterReadings: parsed.meterReadings || [], annualReports: parsed.annualReports || [], waterBills: parsed.waterBills?.length ? parsed.waterBills : INITIAL_WATER }
  } catch { return defaultData }
}
const labels: Record<string, string> = { dashboard: 'Vue d’ensemble', contracts: 'Mes contrats', analysis: 'Analyser ma consommation', calculator: 'Calculer', appliances: 'Mes appareils', compare: 'Comparer', savings: 'Économiser', learn: 'Comprendre', water: 'Eau' }

type StoredPdf = { id: string; name: string; addedAt: string; size: number; blob: Blob }
const PDF_DB = 'watts-pdf-library'
function openPdfDb(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{ const r=indexedDB.open(PDF_DB,1); r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents',{keyPath:'id'})}; r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error) }) }
async function savePdf(file:File):Promise<string>{const db=await openPdfDb(),id=uid();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id,name:file.name,addedAt:new Date().toISOString(),size:file.size,blob:file});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();return id}
async function listPdfs():Promise<Omit<StoredPdf,'blob'>[]>{const db=await openPdfDb();const a=await new Promise<StoredPdf[]>((resolve,reject)=>{const r=db.transaction('documents','readonly').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return a.map(({blob,...v})=>v)}
async function getPdf(id:string):Promise<StoredPdf|undefined>{const db=await openPdfDb();const a=await new Promise<StoredPdf|undefined>((resolve,reject)=>{const r=db.transaction('documents','readonly').objectStore('documents').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return a}
async function deletePdf(id:string):Promise<void>{const db=await openPdfDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}

export default function App() {
  const [data, setData] = useState<Data>(loadData)
  const [page, setPage] = useState('dashboard')
  const [toast, setToast] = useState('')
  const [energy, setEnergy] = useState<Energy>('electricity')
  const [calcWatts, setCalcWatts] = useState(1500)
  const [calcHours, setCalcHours] = useState(2)
  const [calcDays, setCalcDays] = useState(30)
  const [calcPrice, setCalcPrice] = useState('')
  const [tempoColor, setTempoColor] = useState<'BLEU'|'BLANC'|'ROUGE'>('BLEU')
  const [tempoSource, setTempoSource] = useState('Sélection manuelle')
  const [tempoLoading, setTempoLoading] = useState(false)
  const [tempoPeriod, setTempoPeriod] = useState<'hp'|'hc'>('hp')
  const [calcGasM3, setCalcGasM3] = useState(10)
  const [calcCoefficient, setCalcCoefficient] = useState(11.2)
  const [compareA, setCompareA] = useState('Radiateur électrique')
  const [compareB, setCompareB] = useState('Sèche-linge')
  const [filter, setFilter] = useState<Energy | 'all'>('all')
  const [editing, setEditing] = useState<Appliance | null>(null)
  const [lesson, setLesson] = useState(0)
  const [billDraft, setBillDraft] = useState({ energy: 'electricity' as Energy, date: new Date().toISOString().slice(0, 10), amount: '', consumption: '', label: '', period: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracted, setExtracted] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfDocs, setPdfDocs] = useState<Omit<StoredPdf,'blob'>[]>([])
  const [pendingPdfId, setPendingPdfId] = useState<string | undefined>()
  const [showContractForm, setShowContractForm] = useState<Energy | null>(null)
  const [annualDraft,setAnnualDraft]=useState({energy:'electricity' as Energy,year:String(new Date().getFullYear()-1),consumption:'',amount:'',period:'Année civile',source:'Saisie manuelle'})
  const annualFileRef=useRef<HTMLInputElement>(null)
  const waterFileRef=useRef<HTMLInputElement>(null)
  const [waterBusy,setWaterBusy]=useState(false)
  const [waterUnitPrice,setWaterUnitPrice]=useState('7,70')

  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(data)) }, [data])
  useEffect(() => { listPdfs().then(setPdfDocs).catch(() => notify('Bibliothèque PDF indisponible.')) }, [])
  useEffect(() => { document.documentElement.dataset.theme = data.dark ? 'dark' : 'light' }, [data.dark])
  useEffect(() => {
    let alive = true
    const refreshTempo = async () => {
      if (!contract('electricity').tempoMode) return
      setTempoLoading(true)
      try {
        const response = await fetch('https://www.calendrier-tempo.fr/api/today', { cache: 'no-store' })
        if (!response.ok) throw new Error('API indisponible')
        const payload = await response.json()
        const color = String(payload.couleur || '').toUpperCase()
        if (alive && payload.status === 'ok' && ['BLEU','BLANC','ROUGE'].includes(color)) { setTempoColor(color as 'BLEU'|'BLANC'|'ROUGE'); setTempoSource('Couleur du jour récupérée automatiquement') }
        else if (alive) setTempoSource('Couleur indisponible : sélection manuelle')
      } catch { if (alive) setTempoSource('API indisponible : sélection manuelle') }
      finally { if (alive) setTempoLoading(false) }
    }
    refreshTempo()
    const timer = window.setInterval(refreshTempo, 30 * 60 * 1000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [data.contracts])
  const contract = (e: Energy) => data.contracts.find(c => c.energy === e) || defaultData.contracts.find(c => c.energy === e)!
  const updateContract = (e: Energy, patch: Partial<Contract>) => setData(d => ({ ...d, contracts: d.contracts.map(c => c.energy === e ? { ...c, ...patch, updated: new Date().toISOString().slice(0, 10) } : c) }))
  const notify = (s: string) => { setToast(s); window.setTimeout(() => setToast(''), 2800) }
  const priceFor = (e: Energy) => {
    const c = contract(e)
    return calcPrice.trim() && energy === e ? Number(calcPrice.replace(',', '.')) : c.price
  }
  const monthly = useMemo(() => data.appliances.reduce((sum, a) => {
    const c = contract(a.energy)
    const kwh = a.energy === 'electricity' ? a.watts / 1000 * a.hours * a.days : a.watts / 1000 * a.hours * a.days
    return sum + kwh * c.price
  }, 0), [data])
  const totals = useMemo(() => ({
    electricity: data.bills.filter(b => b.energy === 'electricity').reduce((s, b) => s + b.amount, 0),
    gas: data.bills.filter(b => b.energy === 'gas').reduce((s, b) => s + b.amount, 0),
  }), [data.bills])
  const calcKwh = calcWatts / 1000 * calcHours * calcDays
  const electricityContract = contract('electricity')
  const tempoRate = tempoColor === 'BLEU' ? (tempoPeriod === 'hp' ? electricityContract.tempoBlueHp : electricityContract.tempoBlueHc) : tempoColor === 'BLANC' ? (tempoPeriod === 'hp' ? electricityContract.tempoWhiteHp : electricityContract.tempoWhiteHc) : (tempoPeriod === 'hp' ? electricityContract.tempoRedHp : electricityContract.tempoRedHc)
  const calcCost = calcKwh * (energy === 'electricity' && electricityContract.tempoMode ? (calcPrice.trim() ? Number(calcPrice.replace(',', '.')) : Number(tempoRate || 0)) : priceFor(energy))
  const gasKwh = calcGasM3 * calcCoefficient
  const gasCost = gasKwh * contract('gas').price

  async function importPdf(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { notify('Sélectionnez un fichier PDF.'); return }
    setPdfBusy(true); setExtracted('')
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
      let text = ''
      for (let i=1;i<=Math.min(pdf.numPages,20);i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=content.items.map((item:any)=>item.str||'').join(' ')+'\\n'}
      const lower=text.toLowerCase()
      const energy:Energy=/gaz|m3|m³/i.test(lower)&&!/électricité/i.test(lower)?'gas':'electricity'
      const money = (value:string) => value.replace(/\\s/g,'').replace(/€/g,'').replace(',','.')
      const amountPatterns = [
        /(?:total\\s*(?:ttc)?|montant\\s*(?:total)?\\s*ttc|total à payer|net à payer)[^\\d]{0,70}(-?\\d[\\d\\s]*(?:[,.]\\d{2})|\\(\\s*\\d[\\d\\s]*(?:[,.]\\d{2})\\s*\\))/i,
        /(?:montant de votre facture)[^\\d]{0,50}(-?\\d[\\d\\s]*(?:[,.]\\d{2})|\\(\\s*\\d[\\d\\s]*(?:[,.]\\d{2})\\s*\\))/i
      ]
      const consumptionPatterns = energy==='electricity'
        ? [/(?:consommation totale|total consommation|énergie consommée|consommation facturée)[^\\d]{0,90}(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*kwh/i,/(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*kwh[^\\n]{0,35}(?:consommation|total)/i]
        : [/(?:consommation totale|volume consommé|consommation facturée)[^\\d]{0,90}(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*(?:kwh|m³|m3)/i]
      const amountMatch=amountPatterns.map(r=>text.match(r)).find(Boolean)
      const consumptionMatch=consumptionPatterns.map(r=>text.match(r)).find(Boolean)
      const periodMatch=text.match(/(?:du|période du)\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4})\\s*(?:au|à)\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4})/i)
      const invoiceDateMatch=text.match(/(?:facture du|date de facture|émise le)\\s*(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4})/i)
      const toIso=(raw?:string)=>{if(!raw)return '';const m=raw.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{2,4})$/);if(!m)return '';const year=m[3].length===2?'20'+m[3]:m[3];return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
      const amount=amountMatch?.[1]?money(amountMatch[1]):''
      const consumption=consumptionMatch?.[1]?money(consumptionMatch[1]):''
      const period=periodMatch?`${periodMatch[1]} au ${periodMatch[2]}`:''
      const detectedDate=toIso(invoiceDateMatch?.[1]||periodMatch?.[2])||new Date().toISOString().slice(0,10)
      const id=await savePdf(file);setPdfDocs(v=>[{id,name:file.name,addedAt:new Date().toISOString(),size:file.size},...v]);setPendingPdfId(id)
      setBillDraft(v=>({...v,energy,label:file.name,date:detectedDate,period,amount:amount||v.amount,consumption:consumption||v.consumption}))
      setExtracted((text.trim()||'Aucun texte exploitable. Le PDF est peut-être un scan.')+'\\n\\nDonnées détectées automatiquement :\\nÉnergie : '+(energy==='electricity'?'Électricité':'Gaz')+'\\nMontant TTC : '+(amount||'non détecté')+' €\\nConsommation : '+(consumption||'non détectée')+' kWh\\nPériode : '+(period||'non détectée')+'\\nDate retenue : '+detectedDate+'\\n\\nVérifiez et corrigez les champs du formulaire avant de valider.')
      notify('PDF conservé. Vérifiez les données détectées avant validation.')
    } catch {setExtracted('Lecture impossible. Vous pouvez saisir les données manuellement.');notify('Impossible de lire ou conserver ce PDF.')}
    finally {setPdfBusy(false);if(fileRef.current)fileRef.current.value=''}
  }

  const importWaterPdfs=async(files:FileList|null)=>{
    if(!files?.length)return
    setWaterBusy(true)
    try{
      const added:WaterBill[]=[]
      for(const file of Array.from(files)){
        const bytes=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data:bytes}).promise
        let raw=''
        for(let i=1;i<=Math.min(pdf.numPages,4);i++){const pg=await pdf.getPage(i),c=await pg.getTextContent();raw+=' '+c.items.map((x:any)=>x.str||'').join(' ')}
        const txt=raw.replace(/\s+/g,' ')
        const fm=file.name.match(/(20\d{2})(\d{2})(\d{2})/)
        const dm=txt.match(/(?:facture|émise le|date de facture)[^\d]{0,20}(\d{2})\/(\d{2})\/(20\d{2})/i)
        const date=fm?`${fm[1]}-${fm[2]}-${fm[3]}`:dm?`${dm[3]}-${dm[2]}-${dm[1]}`:new Date().toISOString().slice(0,10)
        const vm=[/(?:volume|consommation)(?:\s+d'eau)?[^0-9]{0,70}(\d{1,4})\s*m[³3]/i,/(\d{1,4})\s*m[³3][^.!]{0,80}(?:consommation|volume)/i].map(r=>txt.match(r)).find(Boolean)
        const pm=txt.match(/(?:du|période du)\s*(\d{2}\/\d{2}\/\d{4})\s*(?:au|à)\s*(\d{2}\/\d{2}\/\d{4})/i)
        const pdfId=await savePdf(file);setPdfDocs(v=>[{id:pdfId,name:file.name,addedAt:new Date().toISOString(),size:file.size},...v])
        if(vm&&Number(vm[1])>0)added.push({id:uid(),date,period:pm?`${pm[1]} au ${pm[2]}`:'Période à vérifier',consumption:Number(vm[1]),unitPrice:0.0077,label:file.name,pdfId})
        else notify(`PDF conservé ; volume non détecté, à saisir/vérifier : ${file.name}`)
      }
      if(added.length)setData(d=>({...d,waterBills:[...d.waterBills.map(old=>{const match=added.find(x=>x.date===old.date);return match?{...old,pdfId:match.pdfId,label:match.label}:old}),...added.filter(x=>!d.waterBills.some(old=>old.date===x.date))]}))
      notify(`${added.length} facture(s) d’eau intégrée(s). Vérifiez les données extraites.`)
    }catch{notify('Lecture PDF impossible.')}
    finally{setWaterBusy(false);if(waterFileRef.current)waterFileRef.current.value=''}
  }

  const addBill = () => {
    const amount = Number(billDraft.amount.replace(',', '.'))
    const consumption = Number(billDraft.consumption.replace(',', '.'))
    if (!billDraft.amount.trim() || !Number.isFinite(amount) || !billDraft.consumption.trim() || !Number.isFinite(consumption) || consumption < 0) { notify('Renseignez un montant valide et une consommation positive ou nulle.'); return }
    setData(d => ({ ...d, bills: [{ id: uid(), energy: billDraft.energy, date: billDraft.date, amount, consumption, label: billDraft.label || 'Facture', pdfId: pendingPdfId, period: billDraft.period }, ...d.bills] }))
    setBillDraft(v => ({ ...v, amount: '', consumption: '', label: '', period: '' })); setExtracted(''); setPendingPdfId(undefined); notify('Facture ajoutée à votre historique.')
  }
  const openStoredPdf = async (id:string) => {const item=await getPdf(id);if(!item){notify('PDF introuvable.');return}const url=URL.createObjectURL(item.blob);window.open(url,'_blank','noopener');window.setTimeout(()=>URL.revokeObjectURL(url),60000)}
  const removeStoredPdf = async (id:string) => {await deletePdf(id);setPdfDocs(v=>v.filter(x=>x.id!==id));setData(d=>({...d,bills:d.bills.map(b=>b.pdfId===id?{...b,pdfId:undefined}:b)}));notify('PDF supprimé.')}
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'watts-sauvegarde.json'; a.click(); URL.revokeObjectURL(url)
  }
  const importBackup = async (file?: File) => {
    if (!file) return
    try { const parsed = JSON.parse(await file.text()); if (!parsed.contracts || !parsed.appliances) throw new Error(); setData({ ...defaultData, ...parsed, waterBills: parsed.waterBills?.length ? parsed.waterBills : INITIAL_WATER }); notify('Sauvegarde restaurée.') } catch { notify('Fichier de sauvegarde invalide.') }
  }
  const addAppliance = () => setEditing({ id: uid(), name: '', category: 'Autre', energy: 'electricity', watts: 500, hours: 1, days: 30, note: '' })
  const saveAppliance = () => {
    if (!editing || !editing.name.trim() || editing.watts <= 0) { notify('Indiquez un nom et une puissance valides.'); return }
    setData(d => ({ ...d, appliances: d.appliances.some(a => a.id === editing.id) ? d.appliances.map(a => a.id === editing.id ? editing : a) : [...d.appliances, editing] }))
    setEditing(null); notify('Appareil enregistré.')
  }
  const [annualDetailsDraft,setAnnualDetailsDraft]=useState('')
  const addAnnual=()=>{const consumption=Number(annualDraft.consumption.replace(',','.')),amount=annualDraft.amount.trim()?Number(annualDraft.amount.replace(',','.')):0,year=Number(annualDraft.year);if(!Number.isFinite(consumption)||consumption<0||!Number.isInteger(year)||year<2000||year>2100||!Number.isFinite(amount)){notify('Vérifiez l’année et les valeurs saisies.');return}setData(d=>({...d,annualReports:[...d.annualReports,{id:uid(),energy:annualDraft.energy,year,consumption,amount,period:annualDraft.period,source:annualDraft.source,details:annualDetailsDraft||undefined}]}));setAnnualDraft(v=>({...v,consumption:'',amount:''}));setAnnualDetailsDraft('');notify('Bilan annuel ajouté.')}
  const importAnnualPdf=async(file?:File)=>{
    if(!file)return
    try{
      const buffer=await file.arrayBuffer(),pdf=await pdfjsLib.getDocument({data:buffer}).promise
      let text=''
      for(let i=1;i<=Math.min(pdf.numPages,20);i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=' '+content.items.map((x:any)=>x.str||'').join(' ')}
      const clean=(v:string)=>v.replace(/\\s+/g,' ').trim()
      const number=(v:string)=>Number(v.replace(/\\s/g,'').replace(',','.').replace(/[^\d.-]/g,''))
      const isGas=/ENGIE|GAZ NATUREL|Gaz naturel/i.test(text)&&!/Electricité \(relevé Enedis\)/i.test(text)
      const energy:Energy=isGas?'gas':'electricity'
      let consumption='', amount='', period='', year='', details=''
      if(isGas){
        const k=text.match(/Gaz naturel\s*\+[^0-9]{0,40}([\d\s]{3,})\s*kWh/i)||text.match(/([\d\s]{3,})\s*kWh\s*-\s*Cette consommation/i)
        if(k)consumption=String(number(k[1]))
        const p=text.match(/du\s*(\d{2}\/\d{2}\/\d{2,4})\s*au\s*(\d{2}\/\d{2}\/\d{2,4})/)
        if(p)period=`${p[1]} au ${p[2]}`
        const a=text.match(/TOTAL GAZ NATUREL TTC\s*([\d\s]+,\d{2})\s*€/i)||text.match(/Total TTC\s*([\d\s]+,\d{2})\s*€/i)
        if(a)amount=String(number(a[1]))
        const ix=text.match(/(\d{3,})\s+(\d{3,})\s+(\d{2,})\s+([\d,]+)\s+([\d\s]+)\s*(?:télé-relevé)?/i)
        if(ix)details=`Index gaz : début ${ix[1]} m³ ; fin ${ix[2]} m³ ; volume ${ix[3]} m³ ; coefficient ${ix[4]} ; consommation ${ix[5].replace(/\s/g,'')} kWh.`
      }else{
        const p=text.match(/du\s*(\d{2}\/\d{2}\/\d{2,4})\s*au\s*(\d{2}\/\d{2}\/\d{2,4})/)
        if(p)period=`${p[1]} au ${p[2]}`
        const c=text.match(/Total Consommation(?:\s*\([^)]*\))?\s*([\d\s]{3,})\s+[\d\s]*,[\d]{2}/i)
        if(c)consumption=String(number(c[1]))
        const a=text.match(/Total facture TTC du\s*\d{2}\/\d{2}\/\d{4}\s*([\d\s]+,\d{2})\s*€/i)
        if(a)amount=String(number(a[1]))
        const labels=['Jour Bleu Heures Creuses','Jour Bleu Heures Pleines','Jour Blanc Heures Creuses','Jour Blanc Heures Pleines','Jour Rouge Heures Creuses','Jour Rouge Heures Pleines']
        const vals:string[]=[]
        for(const label of labels){
          const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
          const re=new RegExp(escaped+'[^0-9]{0,220}(\\d{1,7})\\s*\\(Enedis\\)[^0-9]{0,80}(\\d{1,7})\\s*\\(Enedis\\)[^0-9]{0,40}(\\d{1,6})\\s+(?:0[,.]\\d+)', 'i')
          const m=text.match(re)
          if(m)vals.push(`${label}: ${m[1]} → ${m[2]} (${m[3]} kWh)`)
        }
        if(vals.length)details='Répartition Tempo extraite :\\n'+vals.join('\\n')
      }
      const date=text.match(/Facture du\s*(\d{2}\/\d{2}\/\d{4})/i)
      const yearMatch=(period.match(/(\d{4})/)||date?.[1].match(/(\d{4})/))
      year=yearMatch?.[1]||new Date().getFullYear().toString()
      const id=await savePdf(file)
      setPdfDocs(v=>[{id,name:file.name,addedAt:new Date().toISOString(),size:file.size},...v])
      setAnnualDraft(v=>({...v,energy,year,consumption:consumption||v.consumption,amount:amount||v.amount,period:period||v.period,source:file.name}))
      setAnnualDetailsDraft(details)
      setExtracted(`Analyse du document : ${energy==='gas'?'Gaz ENGIE':'Électricité EDF'}\\nConsommation annuelle : ${consumption?consumption+' kWh':'non détectée'}\\nMontant total facturé TTC : ${amount?amount+' €':'non détecté'}\\nPériode : ${period||'non détectée'}\\n${details||'Détail des index / plages non reconnu.'}\\n\\nVérifiez les champs avant validation. Les montants de régularisation (reste à payer ou remboursement) ne sont pas utilisés comme coût annuel.`)
      notify('PDF analysé : vérifiez les données préremplies.')
    }catch{setExtracted('Lecture du PDF impossible. Saisissez les données manuellement.');notify('Lecture du PDF impossible.')}
    finally{if(annualFileRef.current)annualFileRef.current.value=''}
  }
  const nav = (id: string) => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const appCost = (a: Appliance) => a.watts / 1000 * a.hours * a.days * contract(a.energy).price
  const selectedA = data.appliances.find(a => a.name === compareA) || data.appliances[0]
  const selectedB = data.appliances.find(a => a.name === compareB) || data.appliances[1] || data.appliances[0]
  const lessons = [
    { title: 'Watt et kilowatt : la puissance', tag: 'Les bases', body: 'Le watt (W) mesure une puissance : c’est le rythme auquel un appareil utilise de l’énergie lorsqu’il fonctionne. 1 000 watts = 1 kilowatt (kW). Un radiateur de 2 000 W a une puissance de 2 kW.', example: 'Imaginez un robinet : la puissance ressemble au débit instantané.' },
    { title: 'Le kilowattheure : l’énergie consommée', tag: 'Les bases', body: 'Le kilowattheure (kWh) mesure une quantité d’énergie. Pour un appareil dont la puissance est constante : puissance en kW × durée en heures = énergie en kWh.', example: 'Un appareil de 1 kW utilisé pendant 2 heures consomme 2 kWh.' },
    { title: 'Pourquoi la facture est en kWh ?', tag: 'Facture', body: 'Le compteur mesure l’énergie consommée. Le fournisseur applique le prix du kWh, puis ajoute notamment l’abonnement et les taxes ou contributions applicables.', example: '100 kWh × 0,20 € = 20 € de part variable, avant abonnement.' },
    { title: 'Comprendre l’abonnement', tag: 'Facture', body: 'L’abonnement est une part fixe facturée même si vous ne consommez presque rien. Il dépend notamment de l’offre et, en électricité, de la puissance souscrite.', example: 'Un abonnement de 15 € par mois représente 180 € sur douze mois.' },
    { title: 'Heures pleines et heures creuses', tag: 'Tarifs', body: 'Certaines offres proposent deux prix du kWh selon les plages horaires définies pour le point de livraison. Il faut connaître la répartition réelle de vos consommations pour savoir si l’option est intéressante.', example: 'Déplacer un chauffe-eau en heures creuses peut réduire son coût si le tarif et le pilotage s’y prêtent.' },
    { title: 'Le gaz : du m³ au kWh', tag: 'Gaz', body: 'Le compteur de gaz mesure un volume en mètres cubes. La facture convertit ce volume en énergie grâce à un coefficient indiqué par le distributeur. Ce coefficient varie selon le gaz et les conditions de distribution.', example: '10 m³ × coefficient 11,2 = 112 kWh. Utilisez toujours le coefficient de votre facture.' },
    { title: 'Puissance et consommation réelle', tag: 'Appareils', body: 'La puissance affichée est souvent une puissance maximale ou nominale. Un appareil ne fonctionne pas nécessairement à cette puissance pendant toute sa durée d’utilisation : thermostat, cycles et modes éco changent la consommation réelle.', example: 'Un radiateur thermostatique alterne souvent les périodes de chauffe et d’arrêt.' },
    { title: 'Lire une facture', tag: 'Facture', body: 'Repérez la période, l’index ou la consommation, le prix unitaire, l’abonnement, les taxes, les éventuelles régularisations et le total TTC. Comparez des périodes de durée similaire.', example: 'Une facture élevée peut venir d’un hiver plus froid, d’un prix différent ou d’une régularisation.' },
    { title: 'Les appareils en veille', tag: 'Économies', body: 'Une veille consomme peu en puissance mais peut durer 24 h sur 24. Pour l’estimer : watts ÷ 1 000 × heures × jours × prix du kWh.', example: 'Une veille de 5 W pendant 24 h et 365 jours représente 43,8 kWh par an.' },
    { title: 'Comparer les énergies', tag: 'Économies', body: 'Ne comparez pas seulement les prix du kWh. Il faut aussi tenir compte du rendement de l’équipement, des coûts fixes, de l’entretien et de l’usage. Un kWh acheté n’est pas toujours un kWh de chaleur utile.', example: 'Un appareil de chauffage transforme l’énergie avec un rendement qui dépend de sa technologie.' },
  ]
  const energyName = (e: Energy) => e === 'electricity' ? 'Électricité' : 'Gaz'

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => nav('dashboard')}><span className="brand-mark">W</span><span>WATTS<small>MAÎTRISER SON ÉNERGIE</small></span></button>
      <div className="side-label">ESPACE PERSONNEL</div>
      {Object.entries(labels).map(([id, label]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => nav(id)}><span className="nav-icon">{({dashboard:'⌂',contracts:'▤',analysis:'▥',calculator:'∑',appliances:'▦',compare:'⇄',savings:'↗',learn:'✳',water:'💧'} as Record<string,string>)[id]}</span>{label}</button>)}
      <div className="sidebar-bottom"><div className="privacy"><span>●</span><div><b>Vos données restent ici</b><small>Stockage sur cet appareil</small></div></div><button className="theme-toggle" onClick={() => setData(d => ({ ...d, dark: !d.dark }))}>{data.dark ? '☀ Mode clair' : '☾ Mode sombre'}</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">VOTRE ÉNERGIE, EN CLAIR</span><h1>{labels[page]}</h1></div><div className="top-actions"><button className="icon-button" title="Exporter mes données" onClick={exportData}>⇩</button><label className="icon-button upload-backup" title="Restaurer une sauvegarde">⇧<input type="file" accept="application/json" onChange={e => importBackup(e.target.files?.[0])}/></label><div className="avatar">W</div></div></header>

      {page === 'dashboard' && <div className="page-content">
        <section className="hero"><div><span className="hero-kicker">BIENVENUE DANS WATTS</span><h2>Votre énergie mérite<br/>d’être comprise.</h2><p>Suivez vos dépenses, estimez le coût de vos appareils et découvrez où agir.</p><button className="button button-light" onClick={() => nav('calculator')}>Faire un calcul <span>→</span></button></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="hero-bolt">ϟ</div><div className="hero-caption">ÉLECTRICITÉ <i/> GAZ</div></div></section>
        <div className="section-heading"><div><span className="eyebrow">VOTRE SITUATION</span><h2>Vue d’ensemble</h2></div><button className="text-button" onClick={() => nav('contracts')}>Gérer mes contrats →</button></div>
        <div className="metric-grid">
          <Metric icon="ϟ" title="Électricité" value={euro(contract('electricity').price)} unit="/ kWh" detail={contract('electricity').supplier || 'Tarif indicatif ou à personnaliser'} tone="amber"/>
          <Metric icon="♨" title="Gaz" value={euro(contract('gas').price)} unit="/ kWh" detail={contract('gas').supplier || 'Tarif indicatif ou à personnaliser'} tone="blue"/>
          <Metric icon="💧" title="Eau" value={String(data.waterBills.length)} unit=" périodes" detail="Historique semestriel Veolia" tone="blue"/>
          <Metric icon="▤" title="Factures analysées" value={String(data.bills.length)} unit=" facture(s)" detail="Dans votre historique" tone="green"/>
          <Metric icon="⌁" title="Appareils suivis" value={String(data.appliances.length)} unit=" appareils" detail="Estimations personnalisables" tone="purple"/>
        </div>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-head"><div><span className="eyebrow">ESTIMATION INDICATIVE</span><h3>Coût mensuel des appareils</h3></div><span className="pill">Selon vos réglages</span></div><div className="big-number">{euro(monthly)}<small> / mois</small></div><p className="muted">Estimation variable calculée à partir de la puissance, de la durée d’usage et de vos tarifs enregistrés. Hors abonnement.</p><button className="button button-outline" onClick={() => nav('appliances')}>Voir mes appareils →</button></section>
          <section className="panel insight"><div className="insight-icon">✦</div><span className="eyebrow">LE BON RÉFLEXE</span><h3>Un chiffre à comprendre</h3><p>Un appareil de 1 000 W utilisé pendant 1 heure consomme 1 kWh. C’est le kWh qui sert de base à la facturation de l’énergie.</p><button className="text-button" onClick={() => nav('learn')}>Découvrir les bases →</button></section>
        </div>
        <section className="panel quick-panel"><div className="panel-head"><div><span className="eyebrow">POUR ALLER PLUS VITE</span><h3>Que souhaitez-vous faire ?</h3></div></div><div className="quick-grid"><Quick icon="∑" title="Calculer un coût" text="Estimer une consommation" onClick={() => nav('calculator')}/><Quick icon="▤" title="Importer une facture" text="Ajouter une facture PDF" onClick={() => nav('analysis')}/><Quick icon="⇄" title="Comparer" text="Deux appareils ou usages" onClick={() => nav('compare')}/><Quick icon="✳" title="Apprendre" text="Comprendre les notions" onClick={() => nav('learn')}/></div></section>
      </div>}

      {page === 'contracts' && <div className="page-content">
        <div className="section-heading"><div><span className="eyebrow">VOS OFFRES D’ÉNERGIE</span><h2>Mes contrats</h2><p className="muted">Renseignez ici les tarifs et abonnements de vos contrats. Les factures et leur analyse sont regroupées dans « Analyser ma consommation ».</p></div></div>
        <div className="contract-grid">{(['electricity','gas'] as Energy[]).map(e => <ContractCard key={e} energy={e} contract={contract(e)} onEdit={patch => updateContract(e, patch)} onReset={() => setShowContractForm(e)}/>)}</div>
        {showContractForm && <ContractEditor energy={showContractForm} value={contract(showContractForm)} onSave={patch => { updateContract(showContractForm, patch); setShowContractForm(null); notify('Contrat mis à jour.') }} onClose={() => setShowContractForm(null)}/>}
        <section className="panel privacy-panel"><span className="privacy-symbol">✓</span><div><b>Une seule place pour chaque chose</b><p className="muted">Les tarifs et abonnements se règlent ici. Pour importer, consulter ou comparer vos factures, rendez-vous dans « Analyser ma consommation ».</p><button className="button button-outline" onClick={()=>nav('analysis')}>Analyser mes factures →</button></div></section>
      </div>}

      {page === 'water' && <div className="page-content">
        <div className="section-heading"><div><span className="eyebrow">TROISIÈME POSTE DE SUIVI</span><h2>Votre consommation d’eau</h2><p className="muted">Historique semestriel issu de vos factures Veolia. Les soldes à payer ne sont pas assimilés au coût réel de la période.</p></div><button className="button button-primary" onClick={()=>waterFileRef.current?.click()}>＋ Importer des factures PDF</button><input ref={waterFileRef} hidden type="file" accept="application/pdf,.pdf" multiple onChange={e=>importWaterPdfs(e.target.files)}/></div>
        {waterBusy&&<div className="notice">Lecture des factures d’eau en cours…</div>}
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">TARIF INDICATIF</span><h3>Prix variable de l’eau au m³</h3></div><span className="pill">Hors abonnement</span></div><div className="form-grid"><Field label="Prix TTC estimé" value={waterUnitPrice} suffix="€/m³" onChange={setWaterUnitPrice}/></div><p className="hint">Valeur de départ : environ 7,70 €/m³ d’après les factures récentes (hors abonnement). Modifiez-la si nécessaire. Elle ne reconstitue pas les taxes, l’assainissement ni les frais fixes.</p></section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">HISTORIQUE SEMESTRIEL</span><h3>Évolution des volumes</h3></div><span className="pill">{data.waterBills.length} périodes</span></div>
          {data.waterBills.length===0?<Empty text="Aucune facture d’eau enregistrée."/>:<div className="water-chart">{[...data.waterBills].sort((a,b)=>a.date.localeCompare(b.date)).map(b=><div className="water-bar-row" key={b.id}><span>{new Date(b.date+'T12:00:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}</span><div className="water-track"><div className="water-fill" style={{width:`${Math.max(2,b.consumption/Math.max(...data.waterBills.map(x=>x.consumption),1)*100)}%`}}/></div><b>{num(b.consumption)} m³</b></div>)}</div>}
          {data.waterBills.length>0&&<div className="water-summary"><div><small>Dernière période</small><b>{num([...data.waterBills].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)!.consumption)} m³</b></div><div><small>Moyenne semestrielle</small><b>{num(data.waterBills.reduce((a,b)=>a+b.consumption,0)/data.waterBills.length)} m³</b></div><div><small>Coût variable estimé · dernière période</small><b>{euro([...data.waterBills].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)!.consumption*(Number(waterUnitPrice.replace(',','.'))||0))}</b></div></div>}
        </section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">DÉTAIL DES FACTURES</span><h3>Mon historique Veolia</h3></div></div><div className="table-wrap"><table><thead><tr><th>Date facture</th><th>Période</th><th>Volume</th><th>Coût variable estimé</th><th>Document</th><th/></tr></thead><tbody>{[...data.waterBills].sort((a,b)=>b.date.localeCompare(a.date)).map(b=><tr key={b.id}><td>{new Date(b.date+'T12:00:00').toLocaleDateString('fr-FR')}</td><td>{b.period}</td><td><b>{num(b.consumption)} m³</b></td><td>{euro(b.consumption*(Number(waterUnitPrice.replace(',','.'))||0))}</td><td>{b.pdfId?<button className="text-button" onClick={()=>openStoredPdf(b.pdfId!)}>Ouvrir PDF</button>:'—'}</td><td><button className="delete-button" onClick={()=>setData(d=>({...d,waterBills:d.waterBills.filter(x=>x.id!==b.id)}))}>×</button></td></tr>)}</tbody></table></div><p className="hint">Le coût affiché est une estimation variable à partir du prix au m³. Il ne représente pas le total de facture : abonnement, assainissement, taxes et reports sont distincts.</p></section>
      </div>}

      {page === 'analysis' && <div className="page-content">
        <div className="section-heading"><div><span className="eyebrow">VOTRE HISTORIQUE</span><h2>Analyser ma consommation</h2><p className="muted">Importez vos factures d’électricité et de gaz : WATTS en extrait les informations disponibles pour suivre les consommations et les montants. Les index restent ceux indiqués sur vos factures ; aucune saisie de relevé n’est nécessaire.</p></div><button className="button button-primary" onClick={() => fileRef.current?.click()}>＋ Importer une facture PDF</button><input ref={fileRef} hidden type="file" accept="application/pdf,.pdf" onChange={e => importPdf(e.target.files?.[0])}/></div>
        {pdfBusy && <div className="notice">Lecture du PDF en cours, directement dans votre navigateur…</div>}
        {extracted && <section className="panel"><div className="panel-head"><div><span className="eyebrow">VÉRIFICATION</span><h3>Informations détectées</h3></div><button className="text-button" onClick={() => setExtracted('')}>Fermer</button></div><p className="muted small">L’extraction est indicative. Vérifiez les informations avant de les ajouter à votre historique.</p><pre className="extracted">{extracted.slice(0, 6000)}</pre></section>}
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">1 · HISTORIQUE DES FACTURES</span><h3>Électricité et gaz</h3></div><span className="pill">{data.bills.length} facture(s)</span></div>
          <div className="bill-form">
            <select value={billDraft.energy} onChange={e => setBillDraft(v => ({...v, energy:e.target.value as Energy}))}><option value="electricity">Électricité</option><option value="gas">Gaz</option></select>
            <input type="date" aria-label="Date de facture" value={billDraft.date} onChange={e => setBillDraft(v => ({...v,date:e.target.value}))}/>
            <label className="field"><span>Montant TTC (€)</span><input placeholder="Ex. 125,40 ou -32,50" inputMode="decimal" value={billDraft.amount} onChange={e => setBillDraft(v => ({...v,amount:e.target.value}))}/><small>Un montant négatif correspond à un avoir ou une régularisation en votre faveur.</small></label>
            <input placeholder="Consommation (kWh)" aria-label="Consommation en kWh" value={billDraft.consumption} onChange={e => setBillDraft(v => ({...v,consumption:e.target.value}))}/>
            <input placeholder="Période (ex. 01/10 au 31/10)" value={billDraft.period} onChange={e => setBillDraft(v => ({...v,period:e.target.value}))}/><input placeholder="Libellé / fournisseur" value={billDraft.label} onChange={e => setBillDraft(v => ({...v,label:e.target.value}))}/>
            <button className="button button-primary" onClick={addBill}>Ajouter à l’historique</button>
          </div>
          {data.bills.length === 0 ? <Empty text="Aucune facture enregistrée. Importez un PDF pour extraire les données ou complétez les champs manuellement."/ > : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Période</th><th>Énergie</th><th>Libellé</th><th>Consommation</th><th>Montant</th><th/></tr></thead><tbody>{data.bills.map(b => <tr key={b.id}><td>{new Date(b.date+'T12:00:00').toLocaleDateString('fr-FR')}</td><td>{b.period || '—'}</td><td><span className={`energy-dot ${b.energy}`}/>{energyName(b.energy)}</td><td>{b.label}</td><td>{num(b.consumption)} kWh</td><td><b>{euro(b.amount)}</b></td><td><button className="delete-button" aria-label="Supprimer cette facture" onClick={() => setData(d => ({...d,bills:d.bills.filter(x=>x.id!==b.id)}))}>×</button></td></tr>)}</tbody></table></div>}
        </section>
        <section className="panel pdf-library"><div className="panel-head"><div><span className="eyebrow">DOCUMENTS CONSERVÉS SUR CET APPAREIL</span><h3>Bibliothèque des PDF</h3></div><span className="pill">{pdfDocs.length} document(s)</span></div>{pdfDocs.length ? <div className="pdf-list">{pdfDocs.map(doc=><div className="pdf-row" key={doc.id}><span className="pdf-icon">PDF</span><div className="pdf-meta"><b>{doc.name}</b><small>{new Date(doc.addedAt).toLocaleDateString('fr-FR')} · {(doc.size/1024).toFixed(0)} Ko</small></div><button className="text-button" onClick={()=>openStoredPdf(doc.id)}>Ouvrir</button><button className="delete-button" aria-label="Supprimer le PDF" onClick={()=>removeStoredPdf(doc.id)}>×</button></div>)}</div>:<p className="muted small">Les PDF importés apparaîtront ici. Ils restent stockés localement dans ce navigateur.</p>}</section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">2 · BILANS ANNUELS FOURNISSEUR</span><h3>Compléter un bilan annuel</h3></div><button className="button button-outline" onClick={()=>annualFileRef.current?.click()}>Importer un PDF de bilan</button><input ref={annualFileRef} hidden type="file" accept="application/pdf,.pdf" onChange={e=>importAnnualPdf(e.target.files?.[0])}/></div><div className="bill-form"><select value={annualDraft.energy} onChange={e=>setAnnualDraft(v=>({...v,energy:e.target.value as Energy}))}><option value="electricity">Électricité</option><option value="gas">Gaz</option></select><input type="number" min="2000" max="2100" value={annualDraft.year} onChange={e=>setAnnualDraft(v=>({...v,year:e.target.value}))} placeholder="Année"/><input inputMode="decimal" value={annualDraft.consumption} onChange={e=>setAnnualDraft(v=>({...v,consumption:e.target.value}))} placeholder="Consommation annuelle (kWh)"/><input inputMode="decimal" value={annualDraft.amount} onChange={e=>setAnnualDraft(v=>({...v,amount:e.target.value}))} placeholder="Montant annuel (€), facultatif"/><input value={annualDraft.period} onChange={e=>setAnnualDraft(v=>({...v,period:e.target.value}))} placeholder="Période"/><button className="button button-primary" onClick={addAnnual}>Ajouter le bilan</button></div>{annualDetailsDraft && <pre className="extracted">{annualDetailsDraft}</pre>}{data.annualReports.length===0?<Empty text="Aucun bilan annuel enregistré. Vous pouvez en ajouter un si votre fournisseur fournit un récapitulatif annuel."/>:<div className="table-wrap"><table><thead><tr><th>Année</th><th>Énergie</th><th>Consommation</th><th>Montant</th><th>Période / source</th><th/></tr></thead><tbody>{[...data.annualReports].sort((a,b)=>b.year-a.year).map(r=><tr key={r.id}><td>{r.year}</td><td>{energyName(r.energy)}</td><td><b>{num(r.consumption)} kWh</b></td><td>{r.amount?euro(r.amount):'—'}</td><td>{r.period} · {r.source}</td><td><button className="delete-button" onClick={()=>setData(d=>({...d,annualReports:d.annualReports.filter(x=>x.id!==r.id)}))}>×</button></td></tr>)}</tbody></table></div>}</section>
        <section className="panel"><span className="eyebrow">3 · COMPARAISON ANNUELLE</span><h3>Évolution de vos consommations</h3>{(['electricity','gas'] as Energy[]).map(e=>{const rows=data.annualReports.filter(r=>r.energy===e).sort((a,b)=>a.year-b.year);return <div key={e} style={{marginTop:18}}><b>{energyName(e)}</b>{rows.length===0?<p className="muted small">Ajoutez des bilans annuels pour afficher l’évolution.</p>:rows.map((r,i)=>{const prev=rows[i-1],pct=prev?(r.consumption-prev.consumption)/prev.consumption*100:null;return <div className="annual-bar-row" key={r.id}><span>{r.year}</span><div className="annual-track"><div className="annual-fill" style={{width:`${Math.max(2,r.consumption/Math.max(...rows.map(x=>x.consumption),1)*100)}%`}}/></div><b>{num(r.consumption)} kWh</b><small>{pct===null?'Référence':`${pct>0?'+':''}${num(pct)} %`}</small></div>})}</div>})}<p className="hint">Les bilans annuels et les factures détaillées sont affichés séparément pour éviter tout double comptage. Comparez des périodes et périmètres équivalents.</p></section>
        <section className="panel privacy-panel"><span className="privacy-symbol">▣</span><div><b>Vos documents restent privés</b><p className="muted">Les PDF sont lus directement dans votre navigateur et conservés sur cet appareil. Les informations extraites restent à vérifier avant validation.</p></div></section>
      </div>}

      {page === 'calculator' && <div className="page-content">
        <div className="segmented"><button className={energy==='electricity'?'selected':''} onClick={()=>setEnergy('electricity')}>ϟ Électricité</button><button className={energy==='gas'?'selected':''} onClick={()=>setEnergy('gas')}>♨ Gaz</button></div>
        {energy === 'electricity' ? <div className="calculator-layout"><section className="panel calculator-panel"><span className="eyebrow">CALCULATEUR ÉLECTRIQUE</span><h2>Que consomme votre appareil ?</h2><p className="muted">Renseignez sa puissance et son temps de fonctionnement.</p><Field label="Puissance de l’appareil" value={String(calcWatts)} suffix="W" onChange={v=>setCalcWatts(Math.max(0,Number(v)||0))}/><Range label="Heures d’utilisation par jour" value={calcHours} min={0.25} max={24} step={0.25} onChange={setCalcHours}/><Range label="Nombre de jours" value={calcDays} min={1} max={365} step={1} onChange={setCalcDays}/>{contract('electricity').tempoMode ? <div className="tempo-calculator"><div className="tempo-heading"><b>Tarif Tempo appliqué</b><span>{tempoLoading ? 'Actualisation…' : tempoSource}</span></div><div className="tempo-selects"><label className="field"><span>Couleur du jour</span><select value={tempoColor} onChange={e=>{setTempoColor(e.target.value as 'BLEU'|'BLANC'|'ROUGE');setTempoSource('Sélection manuelle')}}><option value="BLEU">Bleu</option><option value="BLANC">Blanc</option><option value="ROUGE">Rouge</option></select></label><label className="field"><span>Plage horaire</span><select value={tempoPeriod} onChange={e=>setTempoPeriod(e.target.value as 'hp'|'hc')}><option value="hp">Heures pleines (6 h–22 h)</option><option value="hc">Heures creuses (22 h–6 h)</option></select></label></div><div className="tempo-current-rate">{num(Number(tempoRate || 0))} €/kWh</div><Field label="Autre prix (facultatif)" value={calcPrice} suffix="€/kWh" placeholder={num(Number(tempoRate || 0))} onChange={setCalcPrice}/><p className="hint">La couleur est récupérée automatiquement. Vérifiez-la sur votre compteur en cas de doute. Source : <a href="https://www.calendrier-tempo.fr/api-tempo" target="_blank" rel="noreferrer">Calendrier Tempo</a>.</p></div> : <><Field label="Prix du kWh TTC (facultatif)" value={calcPrice} suffix="€/kWh" placeholder={num(contract(energy).price)} onChange={setCalcPrice}/><p className="hint">Par défaut, WATTS utilise le tarif de votre contrat ({num(contract(energy).price)} €/kWh).</p></>}</section><ResultCard kwh={calcKwh} cost={calcCost} daily={calcCost/calcDays} title="Résultat de votre estimation" note="Hypothèse : puissance constante pendant toute la durée indiquée. Pour les appareils à cycles ou thermostat, le résultat peut surestimer la consommation réelle."/></div> :
        <div className="calculator-layout"><section className="panel calculator-panel"><span className="eyebrow">CALCULATEUR GAZ</span><h2>Estimer votre consommation de gaz</h2><p className="muted">Le compteur mesure un volume en m³. La facture le convertit en kWh.</p><Field label="Volume consommé" value={String(calcGasM3)} suffix="m³" onChange={v=>setCalcGasM3(Math.max(0,Number(v)||0))}/><Field label="Coefficient de conversion" value={String(calcCoefficient)} suffix="kWh/m³" onChange={v=>setCalcCoefficient(Math.max(0,Number(v)||0))}/><p className="hint">Coefficient indicatif par défaut : 11,2. Remplacez-le par celui de votre facture.</p><Field label="Prix du kWh gaz TTC" value={String(contract('gas').price)} suffix="€/kWh" onChange={v=>updateContract('gas',{price:Math.max(0,Number(v)||0)})}/></section><ResultCard kwh={gasKwh} cost={gasCost} daily={gasCost} title="Votre consommation de gaz" note="Estimation de la part variable uniquement, hors abonnement. Le coefficient exact figure sur votre facture."/></div>}
        <section className="learning-callout"><div className="callout-icon">?</div><div><b>Pourquoi le résultat est en kWh ?</b><p>Le kWh est l’unité utilisée pour facturer l’énergie, aussi bien pour l’électricité que pour le gaz. <button className="inline-link" onClick={()=>nav('learn')}>Comprendre les unités →</button></p></div></section>
      </div>}

      {page === 'appliances' && <div className="page-content">
        <div className="section-heading"><div><span className="eyebrow">VOTRE ÉQUIPEMENT</span><h2>La bibliothèque des appareils</h2><p className="muted">Des puissances indicatives à adapter à vos équipements réels.</p></div><button className="button button-primary" onClick={addAppliance}>＋ Ajouter un appareil</button></div>
        <div className="filter-row"><button className={filter==='all'?'filter active-filter':''} onClick={()=>setFilter('all')}>Tous</button><button className={filter==='electricity'?'filter active-filter':''} onClick={()=>setFilter('electricity')}>ϟ Électricité</button><button className={filter==='gas'?'filter active-filter':''} onClick={()=>setFilter('gas')}>♨ Gaz</button></div>
        <div className="appliance-grid">{data.appliances.filter(a=>filter==='all'||a.energy===filter).map(a=><div className="appliance-card" key={a.id}><div className="appliance-top"><span className={`appliance-symbol ${a.energy}`}>{a.energy==='electricity'?'ϟ':'♨'}</span><span className="pill">{a.category}</span><button className="more-button" onClick={()=>setEditing(a)}>···</button></div><h3>{a.name}</h3><div className="appliance-watts">{num(a.watts)} <small>W</small></div><p className="muted small">{num(a.hours)} h/jour · {a.days} jours/mois</p><div className="appliance-cost"><span>Coût estimé / mois</span><b>{euro(appCost(a))}</b></div>{a.note && <p className="hint">{a.note}</p>}<button className="text-button" onClick={()=>setEditing(a)}>Modifier les paramètres →</button></div>)}</div>
        {editing && <ApplianceEditor value={editing} onChange={setEditing} onSave={saveAppliance} onDelete={()=>{setData(d=>({...d,appliances:d.appliances.filter(a=>a.id!==editing.id)}));setEditing(null);notify('Appareil supprimé.')}} onClose={()=>setEditing(null)} isNew={!data.appliances.some(a=>a.id===editing.id)}/>}
      </div>}

      {page === 'compare' && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">METTRE EN PERSPECTIVE</span><h2>Comparer deux appareils</h2><p className="muted">Comparez leurs coûts estimés avec vos tarifs enregistrés.</p></div></div><section className="panel compare-panel"><div className="compare-selects"><label>Premier appareil<select value={compareA} onChange={e=>setCompareA(e.target.value)}>{data.appliances.map(a=><option key={a.id}>{a.name}</option>)}</select></label><div className="versus">VS</div><label>Second appareil<select value={compareB} onChange={e=>setCompareB(e.target.value)}>{data.appliances.map(a=><option key={a.id}>{a.name}</option>)}</select></label></div><div className="compare-results">{[selectedA,selectedB].map((a,i)=><div className="compare-result" key={a.id}><span className={`appliance-symbol ${a.energy}`}>{a.energy==='electricity'?'ϟ':'♨'}</span><h3>{a.name}</h3><div className="compare-price">{euro(appCost(a))}<small> / mois</small></div><p className="muted small">{num(a.watts)} W · {num(a.hours)} h/jour</p><div className="bar-track"><div className={`bar-fill bar-${i}`} style={{width:`${Math.max(3,appCost(a)/Math.max(appCost(selectedA),appCost(selectedB),0.01)*100)}%`}}/></div></div>)}</div><p className="hint">Les appareils peuvent avoir des usages et des énergies différents. Les résultats ne sont comparables que si les hypothèses d’utilisation sont pertinentes.</p></section></div>}

      {page === 'savings' && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">SIMULER UN CHANGEMENT</span><h2>Et si vous changiez vos habitudes ?</h2><p className="muted">Estimez l’effet d’une réduction du temps d’utilisation d’un appareil.</p></div></div><Savings appliances={data.appliances} price={e=>contract(e).price}/><section className="panel"><span className="eyebrow">QUELQUES REPÈRES</span><h3>Les économies commencent par la mesure</h3><div className="tip-grid"><Tip title="Repérer les veilles" text="Une faible puissance permanente peut finir par représenter une consommation annuelle non négligeable."/><Tip title="Adapter la température" text="Le chauffage est souvent un poste important. Une baisse modérée de consigne peut réduire les besoins, selon le logement."/><Tip title="Comparer les cycles" text="Pour le lave-linge et le sèche-linge, regardez les kWh par cycle indiqués par le fabricant ou l’étiquette énergie."/></div></section></div>}

      {page === 'learn' && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">APPRENDRE À SON RYTHME</span><h2>L’énergie en clair</h2><p className="muted">Des explications courtes, avec des exemples concrets.</p></div><span className="pill">10 mini-leçons</span></div><div className="learn-layout"><nav className="lesson-list">{lessons.map((l,i)=><button key={l.title} className={lesson===i?'lesson-active':''} onClick={()=>setLesson(i)}><span>{String(i+1).padStart(2,'0')}</span><div><small>{l.tag}</small><b>{l.title}</b></div><i>→</i></button>)}</nav><article className="panel lesson-content"><span className="eyebrow">LEÇON {String(lesson+1).padStart(2,'0')} / 10</span><h2>{lessons[lesson].title}</h2><p>{lessons[lesson].body}</p><div className="example-box"><span>✦ EXEMPLE CONCRET</span><b>{lessons[lesson].example}</b></div><div className="lesson-controls"><button className="button button-outline" disabled={lesson===0} onClick={()=>setLesson(v=>v-1)}>← Précédent</button><button className="button button-primary" onClick={()=>setLesson(v=>(v+1)%lessons.length)}>{lesson===lessons.length-1?'Recommencer':'Leçon suivante'} →</button></div></article></div></div>}
      <footer className="footer"><span>WATTS <b>·</b> Comprendre. Calculer. Économiser.</span><span>Vos données restent sur votre appareil.</span></footer>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Metric({icon,title,value,unit,detail,tone}:{icon:string;title:string;value:string;unit:string;detail:string;tone:string}) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span>{title}</span><div className="metric-value">{value}<small>{unit}</small></div><p>{detail}</p></div> }
function Quick({icon,title,text,onClick}:{icon:string;title:string;text:string;onClick:()=>void}) { return <button className="quick-item" onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{text}</small></div><i>→</i></button> }
function Empty({text}:{text:string}) { return <div className="empty-state"><span>▤</span><p>{text}</p></div> }
function Field({label,value,suffix,onChange,placeholder}:{label:string;value:string;suffix:string;onChange:(v:string)=>void;placeholder?:string}) { return <label className="field"><span>{label}</span><div><input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} inputMode="decimal"/><small>{suffix}</small></div></label> }
function Range({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void}) { return <label className="range-field"><span>{label}<b>{num(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label> }
function ResultCard({kwh,cost,daily,title,note}:{kwh:number;cost:number;daily:number;title:string;note:string}) { return <section className="result-card"><span className="result-icon">ϟ</span><span className="eyebrow">{title}</span><div className="result-main">{num(kwh)} <small>kWh</small></div><div className="result-label">Énergie estimée</div><div className="result-cost">{euro(cost)}</div><div className="result-label">Coût variable estimé</div><div className="result-divider"/><div className="result-row"><span>Coût moyen par jour</span><b>{euro(daily)}</b></div><p>{note}</p></section> }
function DecimalField({label,value,suffix,onCommit}:{label:string;value:number;suffix:string;onCommit:(v:number)=>void}) { const [draft,setDraft]=useState(String(value).replace('.',',')); useEffect(()=>{setDraft(String(value).replace('.',','))},[value]); return <label className="field"><span>{label}</span><div><input type="text" inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{const n=Number(draft.trim().replace(',','.'));if(draft.trim()!==''&&Number.isFinite(n)&&n>=0)onCommit(n);else setDraft(String(value).replace('.',','))}}/><small>{suffix}</small></div></label> }
function ContractCard({energy,contract,onEdit,onReset}:{energy:Energy;contract:Contract;onEdit:(p:Partial<Contract>)=>void;onReset:()=>void}) {
 const fields=[['Bleu · Heures pleines','tempoBlueHp'],['Bleu · Heures creuses','tempoBlueHc'],['Blanc · Heures pleines','tempoWhiteHp'],['Blanc · Heures creuses','tempoWhiteHc'],['Rouge · Heures pleines','tempoRedHp'],['Rouge · Heures creuses','tempoRedHc']] as const
 return <section className="panel contract-card"><div className="contract-heading"><span className={`appliance-symbol ${energy}`}>{energy==='electricity'?'ϟ':'♨'}</span><div><span className="eyebrow">MON CONTRAT</span><h3>{energy==='electricity'?'Électricité':'Gaz'}</h3></div><span className="pill">TTC</span></div><label className="field"><span>Fournisseur</span><input value={contract.supplier} placeholder="Ex. fournisseur d’énergie" onChange={e=>onEdit({supplier:e.target.value})}/></label><label className="field"><span>Nom de l’offre</span><input value={contract.offer} placeholder="Nom de votre offre" onChange={e=>onEdit({offer:e.target.value})}/></label><div className="contract-fields"><Field label="Prix du kWh" value={String(contract.price)} suffix="€" onChange={v=>onEdit({price:Math.max(0,Number(v)||0)})}/><DecimalField label="Abonnement mensuel" value={contract.subscription} suffix="€" onCommit={v=>onEdit({subscription:v})}/></div>{energy==='electricity' ? <><label className="check-field"><input type="checkbox" checked={!!contract.hpHc} onChange={e=>onEdit({hpHc:e.target.checked})}/> Mon offre comporte des heures pleines / heures creuses</label><label className="check-field"><input type="checkbox" checked={!!contract.tempoMode} onChange={e=>onEdit({tempoMode:e.target.checked,hpHc:e.target.checked})}/> Mon contrat est une offre Tempo</label>{contract.tempoMode ? <div className="tempo-rates"><b className="tempo-rates-title">Mes six tarifs Tempo (€/kWh TTC)</b>{fields.map(([label,key])=><Field key={key} label={label} value={String(contract[key] ?? 0)} suffix="€/kWh" onChange={v=>onEdit({[key]:Math.max(0,Number(v)||0)} as Partial<Contract>)}/>)}</div> : contract.hpHc && <div className="contract-fields"><Field label="Prix heures pleines" value={String(contract.hpPrice)} suffix="€/kWh" onChange={v=>onEdit({hpPrice:Math.max(0,Number(v)||0)})}/><Field label="Prix heures creuses" value={String(contract.hcPrice)} suffix="€/kWh" onChange={v=>onEdit({hcPrice:Math.max(0,Number(v)||0)})}/></div>}<label className="field"><span>Puissance souscrite</span><select value={contract.power} onChange={e=>onEdit({power:e.target.value})}>{['3 kVA','6 kVA','9 kVA','12 kVA','15 kVA','18 kVA','Autre'].map(x=><option key={x}>{x}</option>)}</select></label></> : <Field label="Coefficient de conversion" value={String(contract.gasCoefficient)} suffix="kWh/m³" onChange={v=>onEdit({gasCoefficient:Math.max(0,Number(v)||0)})}/>}<div className="contract-foot"><span>Modifié : {contract.updated || 'Pas encore renseigné'}</span><button className="text-button" onClick={onReset}>Modifier les détails →</button></div></section>
}
function ContractEditor({energy,value,onSave,onClose}:{energy:Energy;value:Contract;onSave:(p:Partial<Contract>)=>void;onClose:()=>void}) { const [v,setV]=useState(value); return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">PARAMÈTRES DU CONTRAT</span><h2>{energy==='electricity'?'Électricité':'Gaz'}</h2></div><button className="delete-button" onClick={onClose}>×</button></div><p className="muted">Renseignez les informations telles qu’elles apparaissent sur votre facture ou votre espace client.</p><div className="form-grid"><Field label="Prix du kWh TTC" value={String(v.price)} suffix="€" onChange={x=>setV(s=>({...s,price:Number(x)||0}))}/><DecimalField label="Abonnement mensuel TTC" value={v.subscription} suffix="€" onCommit={x=>setV(s=>({...s,subscription:x}))}/>{energy==='gas'&&<Field label="Coefficient m³ → kWh" value={String(v.gasCoefficient)} suffix="kWh/m³" onChange={x=>setV(s=>({...s,gasCoefficient:Number(x)||0}))}/>}</div><div className="modal-actions"><button className="button button-outline" onClick={onClose}>Annuler</button><button className="button button-primary" onClick={()=>onSave(v)}>Enregistrer</button></div></div></div> }
function ApplianceEditor({value,onChange,onSave,onDelete,onClose,isNew}:{value:Appliance;onChange:(v:Appliance)=>void;onSave:()=>void;onDelete:()=>void;onClose:()=>void;isNew:boolean}) { const set=(p:Partial<Appliance>)=>onChange({...value,...p}); return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">VOTRE ÉQUIPEMENT</span><h2>{isNew?'Ajouter un appareil':'Modifier un appareil'}</h2></div><button className="delete-button" onClick={onClose}>×</button></div><div className="form-grid"><label className="field full"><span>Nom de l’appareil</span><input value={value.name} onChange={e=>set({name:e.target.value})}/></label><label className="field"><span>Énergie</span><select value={value.energy} onChange={e=>set({energy:e.target.value as Energy})}><option value="electricity">Électricité</option><option value="gas">Gaz</option></select></label><label className="field"><span>Catégorie</span><input value={value.category} onChange={e=>set({category:e.target.value})}/></label><Field label="Puissance" value={String(value.watts)} suffix="W" onChange={v=>set({watts:Number(v)||0})}/><Field label="Heures par jour" value={String(value.hours)} suffix="h" onChange={v=>set({hours:Number(v)||0})}/><Field label="Jours par mois" value={String(value.days)} suffix="j" onChange={v=>set({days:Number(v)||0})}/><label className="field full"><span>Note pédagogique</span><textarea value={value.note} onChange={e=>set({note:e.target.value})}/></label></div><div className="modal-actions">{!isNew&&<button className="button button-danger" onClick={onDelete}>Supprimer</button>}<span/><button className="button button-outline" onClick={onClose}>Annuler</button><button className="button button-primary" onClick={onSave}>Enregistrer</button></div></div></div> }
function Savings({appliances,price}:{appliances:Appliance[];price:(e:Energy)=>number}) { const [id,setId]=useState(appliances[0]?.id||''); const [reduction,setReduction]=useState(20); const a=appliances.find(x=>x.id===id)||appliances[0]; if(!a)return <Empty text="Ajoutez un appareil pour lancer une simulation."/>; const before=a.watts/1000*a.hours*a.days*price(a.energy); const saved=before*reduction/100; return <section className="panel savings-panel"><label className="field"><span>Choisir un appareil</span><select value={id} onChange={e=>setId(e.target.value)}>{appliances.map(x=><option value={x.id}>{x.name}</option>)}</select></label><Range label="Réduire le temps d’utilisation de" value={reduction} min={0} max={90} step={5} onChange={setReduction}/><div className="savings-results"><div><span>Coût estimé actuel</span><b>{euro(before)}<small>/mois</small></b></div><div><span>Économie estimée</span><b className="saving-green">{euro(saved)}<small>/mois</small></b></div><div><span>Économie annuelle</span><b className="saving-green">{euro(saved*12)}</b></div></div><div className="saving-message">En réduisant de {reduction}% le temps d’utilisation de <b>{a.name}</b>, vous pourriez économiser environ <b>{euro(saved*12)} par an</b>, selon les hypothèses saisies.</div><p className="hint">Simulation théorique : elle suppose une baisse proportionnelle de la consommation. Elle ne prédit pas les économies réelles d’un logement.</p></section> }
function Tip({title,text}:{title:string;text:string}) { return <div className="tip"><span>✦</span><div><b>{title}</b><p>{text}</p></div></div> }
