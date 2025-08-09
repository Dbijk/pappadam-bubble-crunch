import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { loadOpenCV } from "@/lib/opencv";
import bananaLeaf from "@/assets/banana-leaf.jpg";
import * as Tone from "tone";
import * as QRCode from "qrcode";
import html2canvas from "html2canvas";
import { toast } from "sonner";

declare const cv: any;

// Types for bubble detection results
type Bubble = {
  cx: number;
  cy: number;
  radius: number;
  diameterPx: number;
  sizeClass: "small" | "medium" | "large";
};

function classifyBySize(diameter: number): Bubble["sizeClass"] {
  if (diameter < 25) return "small";
  if (diameter < 50) return "medium";
  return "large";
}

function ratingFromCDI(cdi: number): "Excellent" | "Average" | "Flat" {
  if (cdi > 2.5) return "Excellent"; // totally arbitrary and fun
  if (cdi > 1.2) return "Average";
  return "Flat";
}

function seededRandom(seed: number) {
  // Simple LCG for deterministic fun strings from stats
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

function generatePersonality(count: number, avgDiameter: number): string {
  const rnd = seededRandom(count * 100 + avgDiameter);
  const vibes = [
    "Chaotic Crispy", "Zen Cruncher", "Party Popper", "Wise Wafer", "Bubbly Bard",
    "Mellow Muncher", "Rogue Ripple", "Glorious Guffaw", "Serene Snack", "Thunder Crunch"
  ];
  const traits = [
    "rebellious bubbles", "a meditative crisp", "audacious sizzles", "symmetry wizardry",
    "wholesome puffery", "quirky pop-patterns", "grandiose curvatures", "dangling dimples"
  ];
  const v = vibes[Math.floor(rnd() * vibes.length)];
  const t = traits[Math.floor(rnd() * traits.length)];
  return `${v} with ${t}`;
}

function generateHoroscope(count: number, density: number): string {
  const rnd = seededRandom(Math.round(count * 37 + density * 13));
  const fortunes = [
    "Today your snacks uplift spirits—share one and gain a fan!",
    "Avoid windy places; your crunch may echo rumors.",
    "A golden bubble reveals luck—dip with confidence.",
    "Your path is crispy and clear; trust the sizzle.",
    "Beware of sogginess; stay close to warm company.",
    "A new chutney arrives with delightful surprises.",
  ];
  return fortunes[Math.floor(rnd() * fortunes.length)];
}

function fakeOilEstimate(avgDiameterCm: number, count: number): number {
  // Silly formula: larger average bubbles suggest more steam/oil usage
  return Math.max(2, Math.round((avgDiameterCm * count * 0.08 + 5)));
}

function playBubbleMusic(diameters: number[]) {
  if (!diameters.length) {
    toast("No bubbles to play yet—scan first!");
    return;
  }
  const now = Tone.now();
  const synth = new Tone.Synth({ oscillator: { type: "sine" } }).toDestination();
  const scale = ["C4", "D4", "E4", "G4", "A4", "C5"]; // pentatonic for pleasant sounds
  const maxD = Math.max(...diameters);
  const minD = Math.min(...diameters);
  diameters.slice(0, 24).forEach((d, i) => {
    const t = (d - minD) / Math.max(1, maxD - minD);
    const note = scale[Math.floor(t * (scale.length - 1))];
    const time = now + i * 0.15;
    synth.triggerAttackRelease(note, 0.12, time, 0.6);
  });
}

const RANDOM_FORTUNES = [
  "A crispy opportunity will knock soon — don’t let it burn.",
  "Your future holds endless snacks, but beware of soggy endings.",
  "A stranger will offer you chutney — say yes.",
  "Your week will be full of bubbles… in unexpected places.",
  "One pappadam today will save you from three boring meetings tomorrow.",
  "The more bubbles you have, the more joy you’ll attract.",
  "A golden snack will change your mood instantly.",
  "Beware the overcooked — they bring only bitterness.",
  "Your destiny is as crunchy as your last bite.",
  "A perfect bubble pattern means a perfect day ahead.",
];

const RANDOM_WEATHER = [
  "Crisp skies with a light aroma of fried flour.",
  "Cloudy, but with golden patches of sunshine like fresh pappadams.",
  "Humidity 80% — ideal for maximum crunch retention.",
  "Forecast: scattered snacks across your desk.",
  "High crunch winds approaching from the kitchen.",
  "Chutney drizzle expected in the evening.",
  "Sunny with occasional oil vapour sightings.",
  "Unseasonal heat — pappadam frying may increase.",
  "Warm and bubbly — just like your pappadam.",
  "Low pressure system, high appetite probability.",
];

const RANDOM_PERSONALITY = [
  "Bubbly and optimistic, but prone to slight oiliness under stress.",
  "Golden-hearted with a thin crispy shell.",
  "Flaky at times, but always adds flavor to life.",
  "Soft inside, crunchy outside — a people-pleaser.",
  "Full of surprises and little pockets of joy.",
  "Adventurous — not afraid of the deep fryer of life.",
  "Classic and dependable, like a timeless snack.",
  "Rare and exquisite, but hard to make perfectly.",
  "Playful spirit with a dash of spice.",
  "Unpredictable texture — keeps life interesting.",
];

const SNACK_COMPAT = [
  { name: "Masala chai", score: 92 },
  { name: "Coconut chutney", score: 85 },
  { name: "Sambar", score: 88 },
  { name: "Green chilli pickle", score: 90 },
  { name: "Filter coffee", score: 70 },
  { name: "Rasam", score: 78 },
  { name: "Tomato chutney", score: 82 },
  { name: "Buttermilk", score: 65 },
  { name: "Mint chutney", score: 80 },
  { name: "Tamarind dip", score: 87 },
] as const;

const HEALTH_SUGGESTIONS = [
  "Pair with chutney to boost happiness index.",
  "Avoid over-frying to maintain inner peace.",
  "Drink water to balance crunch-to-thirst ratio.",
  "Share your pappadam — doubles joy, halves calories.",
  "Best enjoyed while standing in the kitchen.",
  "Laugh while eating — increases flavor absorption.",
  "Limit intake to avoid extreme crunch fatigue.",
  "Dip occasionally to soften life’s edges.",
  "Enjoy guilt-free — today is your cheat day.",
  "Eat two — one for health, one for the soul.",
];

export default function PappadamAnalyzer() {
  const [cvReady, setCvReady] = useState(false);
  const [usingCamera, setUsingCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [diameterCm, setDiameterCm] = useState(15);

  const [stats, setStats] = useState({
    count: 0,
    avgDiameterPx: 0,
    avgDiameterCm: 0,
    densityPerCm2: 0,
    cdi: 0,
    rating: "Flat" as ReturnType<typeof ratingFromCDI>,
    personality: "",
    horoscope: "",
    oilMl: 0,
  });

const [funPicks, setFunPicks] = useState({
  fortune: RANDOM_FORTUNES[0],
  weather: RANDOM_WEATHER[0],
  personality: RANDOM_PERSONALITY[0],
  health: HEALTH_SUGGESTIONS[0],
});

const shuffleFun = () => {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  setFunPicks({
    fortune: pick(RANDOM_FORTUNES),
    weather: pick(RANDOM_WEATHER),
    personality: pick(RANDOM_PERSONALITY),
    health: pick(HEALTH_SUGGESTIONS),
  });
};

const videoRef = useRef<HTMLVideoElement | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null); // overlay for AR
const processCanvasRef = useRef<HTMLCanvasElement | null>(null); // hidden processing buffer
const uploadCanvasRef = useRef<HTMLCanvasElement | null>(null); // visible canvas for uploaded image
const reportRef = useRef<HTMLDivElement | null>(null);

const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    loadOpenCV()
      .then(() => {
        setCvReady(true);
        toast("Crunch lab initialized. Ready to analyze!", { duration: 2000 });
      })
      .catch(() => toast("Failed to load OpenCV. Please refresh."));
  }, []);
useEffect(() => { shuffleFun(); }, []);
  
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!scanning) return;
      analyzeCurrentFrame();
      drawOverlay();
      raf = requestAnimationFrame(tick);
    };
    if (scanning) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, diameterCm]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream as any;
        await videoRef.current.play();
        setUsingCamera(true);
        setScanning(true);
      }
    } catch (e) {
      toast("Camera access denied. Try uploading a photo.");
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    if (v && v.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
    setUsingCamera(false);
    setScanning(false);
  }

  function drawOverlay() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Size overlay to source (video or uploaded image drawn on hidden canvas)
    let w = 0, h = 0;
    if (usingCamera && video && video.videoWidth) {
      w = video.videoWidth;
      h = video.videoHeight;
    } else if (processCanvasRef.current) {
      w = processCanvasRef.current.width;
      h = processCanvasRef.current.height;
    }
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Oil vapour particles (simple rising circles) based on bubbles
    const now = performance.now();
    // static particles store on context (hacky but self-contained)
    const storeKey = "__vapour" as const;
    // @ts-ignore
    if (!ctx[storeKey]) ctx[storeKey] = [] as {x:number, y:number, r:number, a:number, vy:number}[];
    // @ts-ignore
    const particles: {x:number, y:number, r:number, a:number, vy:number}[] = ctx[storeKey];

    // spawn a few from random bubbles
    for (let i = 0; i < Math.min(3, bubbles.length); i++) {
      const b = bubbles[Math.floor((now + i) % bubbles.length)];
      if (Math.random() < 0.05) {
        particles.push({ x: b.cx + (Math.random() - 0.5) * b.radius, y: b.cy, r: 2 + Math.random() * 4, a: 0.5, vy: 0.3 + Math.random() * 0.6 });
      }
    }
    // update & draw particles
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y -= p.vy;
      p.a -= 0.005;
      p.r *= 0.997;
      if (p.a <= 0 || p.r < 0.5) particles.splice(i, 1);
      else {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = "hsla(45, 90%, 55%, 0.5)"; // gold-ish steam
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Draw bubbles
    bubbles.forEach(b => {
      const color = b.sizeClass === "small" ? "#22c55e" : b.sizeClass === "medium" ? "#eab308" : "#ef4444"; // via tokens would be ideal; canvas limited
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Scanning line
    if (scanning) {
      const t = (now / 1000) % 2;
      const y = (t < 1 ? t : 2 - t) * h; // ping-pong
      const grad = ctx.createLinearGradient(0, y - 10, 0, y + 10);
      grad.addColorStop(0, "rgba(255, 215, 100, 0)");
      grad.addColorStop(0.5, "rgba(255, 215, 100, 0.6)");
      grad.addColorStop(1, "rgba(255, 215, 100, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 10, w, 20);
    }
  }

  function analyzeCurrentFrame() {
    if (!cvReady) return;
    const canvas = processCanvasRef.current;
    const video = videoRef.current;
    const processCtx = canvas?.getContext("2d");
    if (!canvas || !processCtx) return;

    // Draw source into processing canvas
    if (usingCamera && video && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      processCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Auto contrast (histogram equalization) then Gaussian blur
    const eq = new cv.Mat();
    cv.equalizeHist(gray, eq);
    const blur = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(eq, blur, ksize, 0, 0, cv.BORDER_DEFAULT);

    // Otsu threshold, inverted to get white bubbles on black
    const thresh = new cv.Mat();
    cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    // Morph open to remove noise
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    const opened = new cv.Mat();
    cv.morphologyEx(thresh, opened, cv.MORPH_OPEN, kernel);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(opened, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const found: Bubble[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < 50) { cnt.delete(); continue; }
      const rect = cv.minEnclosingCircle(cnt);
      const r = rect.radius;
      if (r < 3) { cnt.delete(); continue; }
      const cx = rect.center.x;
      const cy = rect.center.y;
      const diameter = r * 2;
      found.push({ cx, cy, radius: r, diameterPx: diameter, sizeClass: classifyBySize(diameter) });
      cnt.delete();
    }

    // Cleanup
    src.delete(); gray.delete(); eq.delete(); blur.delete(); thresh.delete(); opened.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

    setBubbles(found);

    // Compute stats
    const count = found.length;
    const avgDiameterPx = count ? found.reduce((a, b) => a + b.diameterPx, 0) / count : 0;

    // Estimate pixel->cm scaling using a naive rule: pappadam takes ~0.8 of min dimension
    const pxDiameterEstimate = 0.8 * Math.min(canvas.width, canvas.height);

    const pxPerCm = pxDiameterEstimate / Math.max(1, diameterCm);
    const avgDiameterCm = avgDiameterPx / Math.max(1, pxPerCm);

    const areaCm2 = Math.PI * Math.pow(diameterCm / 2, 2);
    const densityPerCm2 = count / Math.max(1, areaCm2);
    const cdi = densityPerCm2 * 10; // boosted for larger numbers on UI
    const rating = ratingFromCDI(cdi);
    const personality = generatePersonality(count, avgDiameterPx);
    const horoscope = generateHoroscope(count, densityPerCm2);
    const oilMl = fakeOilEstimate(avgDiameterCm, count);

    setStats({ count, avgDiameterPx, avgDiameterCm, densityPerCm2, cdi, rating, personality, horoscope, oilMl });
  }

  function handleImageUpload(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const disp = uploadCanvasRef.current;
      const dctx = disp?.getContext("2d");
      const proc = processCanvasRef.current;
      const pctx = proc?.getContext("2d");
      if (!disp || !dctx || !proc || !pctx) return;
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      disp.width = w; disp.height = h; dctx.drawImage(img, 0, 0, w, h);
      proc.width = w; proc.height = h; pctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      setUsingCamera(false);
      setScanning(true);
      analyzeCurrentFrame();
      drawOverlay();
    };
    img.src = url;
  }

  async function generateCertificateQR() {
    const payload = {
      name: "Pappadam Bubble Certificate",
      ts: Date.now(),
      stats,
      // fake chain hash
      hash: Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
    };
    const text = JSON.stringify(payload);
    const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 256, color: { dark: "#123324", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
    toast("Blockchain sealed. Totally legit.");
  }

  async function downloadReport() {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = "pappadam-crunch-report.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const bgStyle = useMemo(() => ({ backgroundImage: `url(${bananaLeaf})` }), []);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full">
      <section className="relative rounded-2xl overflow-hidden p-6 md:p-10 shadow-xl border bg-background/70" style={bgStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background/80" />
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display text-primary mb-2">
            Pappadam Bubble Analyzer — Crunch Science Edition
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Detect, count, and color-code your pappadam bubbles with AR overlays. Pseudo-science, maximum fun.
          </p>
        </div>

        <div className="relative z-10 mt-6">
          <Tabs defaultValue="scan" className="w-full">
            <TabsList>
              <TabsTrigger value="scan">Live Scan</TabsTrigger>
              <TabsTrigger value="upload">Upload Photo</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>AR Scan</CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="diam">Diameter (cm)</Label>
                        <Input id="diam" type="number" min={8} max={30} step={0.5} value={diameterCm}
                          onChange={(e) => setDiameterCm(parseFloat(e.target.value) || 15)} className="w-28" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="scan">Scanning</Label>
                        <Switch id="scan" checked={scanning} onCheckedChange={setScanning} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full overflow-hidden rounded-lg border">
                      <video ref={videoRef} className="w-full h-auto block" playsInline muted />
                      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {!usingCamera ? (
                        <Button onClick={startCamera} disabled={!cvReady}>Start Camera</Button>
                      ) : (
                        <Button variant="secondary" onClick={stopCamera}>Stop Camera</Button>
                      )}
                      <Button variant="accent" onClick={() => playBubbleMusic(bubbles.map(b => b.diameterPx))}>Bubble-to-Music</Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline">Final Report</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[760px]">
                          <DialogHeader>
                            <DialogTitle>Crunch Science Report</DialogTitle>
                          </DialogHeader>
                          <div ref={reportRef} className="bg-background rounded-lg p-4 md:p-6">
                            <h3 className="font-bold text-xl mb-2">Pappadam Crunch Report</h3>
                            <Separator className="my-2" />
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Bubbles</div>
                                <div className="text-2xl font-extrabold text-primary">{stats.count}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Avg Size</div>
                                <div className="text-2xl font-extrabold">{stats.avgDiameterCm.toFixed(2)} cm</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Density</div>
                                <div className="text-2xl font-extrabold">{stats.densityPerCm2.toFixed(3)} /cm²</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Crunch Index</div>
                                <div className="text-2xl font-extrabold text-primary">{stats.cdi.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Oil Usage (est)</div>
                                <div className="text-2xl font-extrabold">{stats.oilMl} ml</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Quality</div>
                                <div className="text-2xl font-extrabold">{stats.rating}</div>
                              </div>
                            </div>
                            <Separator className="my-4" />
<div className="font-fun text-lg">Mood: {stats.personality}</div>
                            <div className="font-fun mt-1">Snack Horoscope: {stats.horoscope}</div>
                            <div className="mt-3 grid gap-1 text-sm">
                              <div><span className="text-muted-foreground">Random Fortune:</span> <span className="font-fun">{funPicks.fortune}</span></div>
                              <div><span className="text-muted-foreground">Weather:</span> <span className="font-fun">{funPicks.weather}</span></div>
                              <div><span className="text-muted-foreground">Personality Analysis:</span> <span className="font-fun">{funPicks.personality}</span></div>
                              <div><span className="text-muted-foreground">Health Suggestion:</span> <span className="font-fun">{funPicks.health}</span></div>
                            </div>
                            <Separator className="my-3" />
                            <div>
                              <div className="text-sm font-medium">Snack Compatibility</div>
                              <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">
                                {SNACK_COMPAT.map((s) => (
                                  <li key={s.name} className="flex items-center justify-between">
                                    <span>{s.name}</span>
                                    <span className="font-semibold">{s.score}%</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="mt-4 flex items-center gap-4">
                              <Button onClick={generateCertificateQR}>Blockchain Bubble Certificate</Button>
                              {qrDataUrl && <img src={qrDataUrl} alt="Bubble Certificate QR" className="w-24 h-24" />}
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 mt-3">
                            <Button variant="secondary" onClick={downloadReport}>Download PNG</Button>
                            <Button onClick={async () => {
                              if ((navigator as any).share && reportRef.current) {
                                const canvas = await html2canvas(reportRef.current);
                                canvas.toBlob(async (blob) => {
                                  if (!blob) return;
                                  const file = new File([blob], 'report.png', { type: 'image/png' });
                                  try { await (navigator as any).share({ files: [file], title: 'Pappadam Report' }); }
                                  catch {}
                                });
                              } else {
                                toast("Web Share not available — use Download instead.");
                              }
                            }}>Share</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <Stat label="Bubble Count" value={stats.count} highlight />
                      <Stat label="Avg Diameter" value={`${stats.avgDiameterCm.toFixed(2)} cm`} />
                      <Stat label="Density" value={`${stats.densityPerCm2.toFixed(3)} /cm²`} />
                      <Stat label="Crunch Density Index" value={stats.cdi.toFixed(2)} highlight />
                      <Stat label="Oil (est)" value={`${stats.oilMl} ml`} />
                      <Stat label="Quality" value={stats.rating} />
                    </div>
<Separator className="my-4" />
                    <div className="font-fun">Personality: {stats.personality}</div>
                    <div className="font-fun">Horoscope: {stats.horoscope}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm font-medium">Fun Extras</div>
                      <Button size="sm" variant="secondary" onClick={shuffleFun}>Shuffle</Button>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li><span className="text-muted-foreground">Random Fortune:</span> <span className="font-fun">{funPicks.fortune}</span></li>
                      <li><span className="text-muted-foreground">Weather:</span> <span className="font-fun">{funPicks.weather}</span></li>
                      <li><span className="text-muted-foreground">Personality Analysis:</span> <span className="font-fun">{funPicks.personality}</span></li>
                      <li><span className="text-muted-foreground">Health Suggestion:</span> <span className="font-fun">{funPicks.health}</span></li>
                    </ul>
                    <Separator className="my-4" />
                    <div>
                      <div className="text-sm font-medium mb-2">Snack Compatibility</div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                        {SNACK_COMPAT.map((s) => (
                          <li key={s.name} className="flex items-center justify-between">
                            <span>{s.name}</span>
                            <span className="font-semibold">{s.score}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Pappadam Photo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <Input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }} />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="diam2">Diameter (cm)</Label>
                      <Input id="diam2" type="number" min={8} max={30} step={0.5} value={diameterCm}
                        onChange={(e) => setDiameterCm(parseFloat(e.target.value) || 15)} className="w-28" />
                    </div>
                    <Button onClick={() => { analyzeCurrentFrame(); drawOverlay(); }}>Analyze</Button>
                  </div>
                  <div className="mt-4 relative">
                    <canvas ref={uploadCanvasRef} className="w-full h-auto border rounded" />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <ComparePanel onCompare={(msg) => toast(msg)} />
            </TabsContent>
          </Tabs>
        </div>
        <canvas ref={processCanvasRef} className="hidden" />
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="p-3 rounded-lg border bg-card/60">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function ComparePanel({ onCompare }: { onCompare: (message: string) => void }) {
  const leftCanvas = useRef<HTMLCanvasElement | null>(null);
  const rightCanvas = useRef<HTMLCanvasElement | null>(null);
  const [leftStats, setLeftStats] = useState<{count:number;cdi:number}>({count:0,cdi:0});
  const [rightStats, setRightStats] = useState<{count:number;cdi:number}>({count:0,cdi:0});

  async function analyzeCanvas(c: HTMLCanvasElement): Promise<{count:number;cdi:number}> {
    await new Promise(r => setTimeout(r, 10)); // ensure draw is flushed
    const src = cv.imread(c);
    const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const eq = new cv.Mat(); cv.equalizeHist(gray, eq);
    const blur = new cv.Mat(); cv.GaussianBlur(eq, blur, new cv.Size(5,5), 0, 0, cv.BORDER_DEFAULT);
    const thresh = new cv.Mat(); cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    const opened = new cv.Mat(); const kernel = cv.Mat.ones(3,3,cv.CV_8U); cv.morphologyEx(thresh, opened, cv.MORPH_OPEN, kernel);
    const contours = new cv.MatVector(); const hierarchy = new cv.Mat();
    cv.findContours(opened, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let count = 0; for (let i = 0; i < contours.size(); i++) { const cnt = contours.get(i); const area = cv.contourArea(cnt); if (area>50) count++; cnt.delete(); }
    src.delete(); gray.delete(); eq.delete(); blur.delete(); thresh.delete(); opened.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
    const cdi = count / 100; // silly
    return { count, cdi };
  }

  function handleUpload(which: 'left'|'right', file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const canvas = which === 'left' ? leftCanvas.current : rightCanvas.current;
      const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
      const scale = Math.min(1, 640 / img.width);
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const res = await analyzeCanvas(canvas);
      if (which==='left') setLeftStats(res); else setRightStats(res);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  useEffect(() => {
    if (leftStats.count === 0 && rightStats.count === 0) return;
    const winner = leftStats.cdi === rightStats.cdi ? 'It\'s a crunchy tie!' : (leftStats.cdi > rightStats.cdi ? 'Left Image wins the bubble challenge!' : 'Right Image wins the bubble challenge!');
    onCompare(winner);
  }, [leftStats, rightStats, onCompare]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare My Pappadam</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Input type="file" accept="image/*" onChange={(e)=>{const f=e.target.files?.[0]; if (f) handleUpload('left', f);}} />
              <div className="text-sm text-muted-foreground">Bubbles: {leftStats.count} | CDI: {leftStats.cdi.toFixed(2)}</div>
            </div>
            <canvas ref={leftCanvas} className="mt-3 w-full h-auto border rounded" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Input type="file" accept="image/*" onChange={(e)=>{const f=e.target.files?.[0]; if (f) handleUpload('right', f);}} />
              <div className="text-sm text-muted-foreground">Bubbles: {rightStats.count} | CDI: {rightStats.cdi.toFixed(2)}</div>
            </div>
            <canvas ref={rightCanvas} className="mt-3 w-full h-auto border rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
