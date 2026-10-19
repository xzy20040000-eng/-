import { templateById, type PosterTemplate } from "./poster-templates";

export type PosterData = { templateId: string; address: string; eventTime: string; logo: File | string | null; qr: File | string | null };
const cache = new Map<string, Promise<HTMLImageElement>>();

async function load(source: File | string | null): Promise<HTMLImageElement | null> {
  if (!source) return null;
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch { throw new Error("素材图片无法读取，请换一张 PNG 或 JPG"); }
  finally { if (typeof source !== "string") URL.revokeObjectURL(url); }
}
function cached(url: string) { if (!cache.has(url)) cache.set(url, load(url).then(image => image!)); return cache.get(url)!; }
function contain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
function drawTrimmedLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): number {
  const sample = document.createElement("canvas");
  const sampleScale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
  sample.width = Math.max(1, Math.round(img.naturalWidth * sampleScale));
  sample.height = Math.max(1, Math.round(img.naturalHeight * sampleScale));
  const sctx = sample.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, sample.width, sample.height);
  const pixels = sctx.getImageData(0, 0, sample.width, sample.height).data;
  let left = sample.width, top = sample.height, right = -1, bottom = -1;
  for (let sy = 0; sy < sample.height; sy++) for (let sx = 0; sx < sample.width; sx++) {
    const i = (sy * sample.width + sx) * 4;
    if (pixels[i+3] < 55 || (pixels[i] > 244 && pixels[i+1] > 244 && pixels[i+2] > 244)) continue;
    left = Math.min(left, sx); top = Math.min(top, sy); right = Math.max(right, sx); bottom = Math.max(bottom, sy);
  }
  if (right < left || bottom < top) return 0;
  const sourceX = left / sampleScale, sourceY = top / sampleScale;
  const sourceW = (right - left + 1) / sampleScale, sourceH = (bottom - top + 1) / sampleScale;
  const ratio = Math.min(w / sourceW, h / sourceH);
  const dw = sourceW * ratio, dh = sourceH * ratio;
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, x, y + (h - dh) / 2, dw, dh);
  return dw;
}
function clearOriginalCompanyMark(ctx: CanvasRenderingContext2D, box: [number,number,number,number], yScale: number) {
  const [x,y,w,h] = box;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x-4,y-4,w+8,h+8);
  // The blue AI glyph extends beyond some PSD-derived boxes. Clear only
  // saturated blue pixels in that narrow overhang, preserving nearby hair.
  const scaleX = 2;
  const scaleY = 2*yScale;
  const sx = Math.round((x+w-70)*scaleX), sy = Math.round((y-15)*scaleY);
  const sw = Math.min(Math.round(145*scaleX),ctx.canvas.width-sx);
  const sh = Math.round((h+60)*scaleY);
  const patch = ctx.getImageData(sx,sy,sw,sh);
  for (let i=0;i<patch.data.length;i+=4) {
    const r=patch.data[i],g=patch.data[i+1],b=patch.data[i+2];
    if (b>95 && b>r*1.3 && b>g*1.16) patch.data[i]=patch.data[i+1]=patch.data[i+2]=255;
  }
  ctx.putImageData(patch,sx,sy);
}
function mainLogoColor(img: HTMLImageElement): string | null {
  const c = document.createElement("canvas"); c.width = c.height = 80;
  const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) return null;
  contain(ctx, img, 0, 0, 80, 80);
  const pixels = ctx.getImageData(0, 0, 80, 80).data;
  const bins = new Float64Array(36);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3] / 255; if (a < .55) continue;
    const r = pixels[i] / 255, g = pixels[i+1] / 255, b = pixels[i+2] / 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    if (d < .16 || max < .16 || min > .86 || d / max < .30) continue;
    let h = max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
    if (h < 0) h += 6;
    bins[Math.floor(h * 6) % 36] += a * d;
  }
  let best = 0; for (let i = 1; i < bins.length; i++) if (bins[i] > bins[best]) best = i;
  if (bins[best] < 3) return null;
  const hue = best * 10 + 5;
  return `hsl(${hue} 67% ${hue > 35 && hue < 75 ? 37 : 41}%)`;
}
function colorParts(color: string): [number, number, number] {
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const cx = c.getContext("2d")!; cx.fillStyle = color; cx.fillRect(0, 0, 1, 1);
  const p = cx.getImageData(0, 0, 1, 1).data;
  const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
  const light = (hi + lo) / 2;
  const sat = d ? d / (1 - Math.abs(2 * light - 1)) : 0;
  let hue = 0;
  if (d) hue = ((hi === r ? (g-b)/d % 6 : hi === g ? (b-r)/d + 2 : (r-g)/d + 4) * 60 + 360) % 360;
  return [hue, sat, light];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, light = (hi + lo) / 2;
  if (!d) return [0, 0, light];
  const sat = d / (1 - Math.abs(2 * light - 1));
  const hue = ((hi === r ? (g-b)/d % 6 : hi === g ? (b-r)/d + 2 : (r-g)/d + 4) * 60 + 360) % 360;
  return [hue, sat, light];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2*l-1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l-c/2;
  const [r,g,b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function colorRgb(color: string): [number, number, number] {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
  const p = ctx.getImageData(0, 0, 1, 1).data;
  return [p[0], p[1], p[2]];
}
// Role maps are derived from each PSD's own shapes and type layers. Recolor
// pixels in the base image directly, never by compositing a tint overlay.
async function recolorFromPsd(ctx: CanvasRenderingContext2D, template: PosterTemplate, accent: string) {
  const [hue, saturation, lightness] = colorParts(accent);
  const roles = template.colorRoles.map(role => {
    const oldLight = rgbToHsl(...role.original)[2];
    const target = role.tone === "hero" ? hslToRgb(hue, saturation, Math.min(.62, lightness+.08))
      : role.tone === "light" ? hslToRgb(hue, Math.min(.85,Math.max(.3,saturation)), template.id === "daniel-0921-blue" ? .92 : Math.min(.955,Math.max(.91,oldLight-.01)))
      : colorRgb(accent);
    return {...role,target};
  });
  const base = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const maskCanvas = document.createElement("canvas"); maskCanvas.width = ctx.canvas.width; maskCanvas.height = ctx.canvas.height;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  for (const role of roles) {
    const mask = await cached(`/templates/${template.id}-${role.name}-mask.png?v=14`);
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.drawImage(mask, 0, 0, maskCanvas.width, maskCanvas.height);
    const coverage = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    const old = role.original, next = role.target;
    for (let i=0; i<base.data.length; i+=4) {
      if (coverage[i] < 16) continue;
      const p = [base.data[i],base.data[i+1],base.data[i+2]];
      if (role.name === "hero-edge") {
        const [oldHue] = rgbToHsl(...old);
        const [pixelHue,pixelSat,pixelLight] = rgbToHsl(...p as [number,number,number]);
        const gap = Math.min(Math.abs(pixelHue-oldHue),360-Math.abs(pixelHue-oldHue));
        if (gap>25 || pixelSat<.35 || pixelLight<.18 || pixelLight>.91 || p[0]<p[1]*1.35 || p[0]<p[2]*1.25) continue;
        const [newHue] = rgbToHsl(...next);
        const [r,g,b] = hslToRgb(newHue,pixelSat,pixelLight);
        base.data[i]=r; base.data[i+1]=g; base.data[i+2]=b;
        continue;
      }
      const endpoint = p[0]+p[1]+p[2] >= old[0]+old[1]+old[2] ? 255 : 0;
      const d0=endpoint-old[0],d1=endpoint-old[1],d2=endpoint-old[2];
      const blend=Math.max(0,Math.min(1,((p[0]-old[0])*d0+(p[1]-old[1])*d1+(p[2]-old[2])*d2)/Math.max(1,d0*d0+d1*d1+d2*d2)));
      const error=Math.sqrt((p[0]-old[0]-blend*d0)**2+(p[1]-old[1]-blend*d1)**2+(p[2]-old[2]-blend*d2)**2);
      if (error > (role.tone === "light" ? 16 : 30)) {
        // PSD title and shape layers may contain a second shade of the source
        // color. Convert those pixels within the layer mask as well.
        if (role.tone === "light") continue;
        const [sourceHue] = rgbToHsl(...old);
        const [pixelHue,pixelSat,pixelLight] = rgbToHsl(...p as [number,number,number]);
        const gap = Math.min(Math.abs(pixelHue-sourceHue),360-Math.abs(pixelHue-sourceHue));
        if (gap > 28 || pixelSat < .22 || pixelLight < .13 || pixelLight > .86) continue;
        const [r,g,b] = hslToRgb(hue,Math.min(saturation,pixelSat),Math.min(.49,Math.max(.25,pixelLight)));
        base.data[i]=r; base.data[i+1]=g; base.data[i+2]=b;
        continue;
      }
      for (let c=0;c<3;c++) base.data[i+c]=Math.round(next[c]+blend*(endpoint-next[c]));
    }
  }
  ctx.putImageData(base, 0, 0);
}
// Large flat fills in the PSD are separate design shapes. Identify their connected
// source-color areas and change those pixels directly; small isolated reds such as
// lips are excluded by the component-area threshold.
function recolorFlatShapes(ctx: CanvasRenderingContext2D, originals: string[], next: string, yScale: number, includeIslands = false, islandRegions: [number, number, number, number][] = [], edgeRadius = 2) {
  const width = ctx.canvas.width, height = Math.min(ctx.canvas.height, Math.ceil(1260*2*yScale));
  const image = ctx.getImageData(0, 0, width, height), p = image.data;
  const sw = Math.floor(width/2), sh = Math.floor(height/2), n = sw*sh;
  const colors = originals.map(value => {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const cx = c.getContext("2d")!; cx.fillStyle = value; cx.fillRect(0,0,1,1);
    const rgb = cx.getImageData(0,0,1,1).data;
    return { rgb: [rgb[0],rgb[1],rgb[2]], hsl: colorParts(value) };
  });
  const core = new Uint8Array(n);
  for (let y=0; y<sh; y++) for (let x=0; x<sw; x++) {
    const i = ((y*2)*width + x*2)*4;
    for (const {rgb} of colors) {
      const dr=p[i]-rgb[0], dg=p[i+1]-rgb[1], db=p[i+2]-rgb[2];
      if (dr*dr+dg*dg+db*db < 35*35) { core[y*sw+x]=1; break; }
    }
  }
  const chosen = new Uint8Array(n), queue = new Int32Array(n);
  for (let start=0; start<n; start++) {
    if (core[start] !== 1) continue;
    let head=0, tail=1; queue[0]=start; core[start]=2;
    while (head<tail) {
      const at=queue[head++], x=at%sw, y=(at/sw)|0;
      if (x>0 && core[at-1]===1) { core[at-1]=2; queue[tail++]=at-1; }
      if (x+1<sw && core[at+1]===1) { core[at+1]=2; queue[tail++]=at+1; }
      if (y>0 && core[at-sw]===1) { core[at-sw]=2; queue[tail++]=at-sw; }
      if (y+1<sh && core[at+sw]===1) { core[at+sw]=2; queue[tail++]=at+sw; }
    }
    // Portrait cutouts split narrow parts of a shape into small islands. Include
    // those islands by position while keeping similarly colored facial details out.
    const sx=start%sw, sourceY=((start/sw)|0)/yScale;
    const shapeIsland=(includeIslands && tail>=50 && (sx>1000 || sourceY>730)) || (tail>=500 && islandRegions.some(([rx,ry,rw,rh]) => sx>=rx && sx<rx+rw && sourceY>=ry && sourceY<ry+rh));
    if (tail>=2000 || shapeIsland) for (let j=0; j<tail; j++) chosen[queue[j]]=1;
  }
  const edge = new Uint8Array(n);
  for (let y=0; y<sh; y++) for (let x=0; x<sw; x++) {
    if (!chosen[y*sw+x]) continue;
    for (let dy=-edgeRadius; dy<=edgeRadius; dy++) for (let dx=-edgeRadius; dx<=edgeRadius; dx++) {
      const nx=x+dx, ny=y+dy;
      if (nx>=0 && nx<sw && ny>=0 && ny<sh) edge[ny*sw+nx]=1;
    }
  }
  const [newHue,newSat,newLight] = colorParts(next);
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    if (!edge[((y/2)|0)*sw+((x/2)|0)]) continue;
    const i=(y*width+x)*4, [hue,sat,light]=rgbToHsl(p[i],p[i+1],p[i+2]);
    if (sat<.10 || light>.98 || light<.1) continue;
    const old=colors.find(({hsl}) => Math.min(Math.abs(hue-hsl[0]),360-Math.abs(hue-hsl[0]))<28);
    if (!old) continue;
    const strength=Math.min(1,sat/Math.max(old.hsl[1],.01));
    const [r,g,b]=hslToRgb(newHue,Math.min(.95,sat*newSat/Math.max(old.hsl[1],.01)),Math.max(0,Math.min(1,light+(newLight-old.hsl[2])*strength)));
    p[i]=r; p[i+1]=g; p[i+2]=b;
  }
  ctx.putImageData(image,0,0);
}
// Directly replace the colored pixels within PSD-derived design-layer bounds.
// No tint overlay or separate color-mask image is composited onto the poster.
function recolorDesignLayers(ctx: CanvasRenderingContext2D, regions: [number,number,number,number][], original: string, next: string, yScale: number) {
  const [oldHue] = colorParts(original), [newHue, newSat] = colorParts(next);
  for (const [rx,ry,rw,rh] of regions) {
    const x = Math.max(0, rx*2), y = Math.max(0, Math.round(ry*2*yScale));
    const w = Math.min(ctx.canvas.width-x, rw*2), h = Math.min(ctx.canvas.height-y, Math.round(rh*2*yScale));
    if (w <= 0 || h <= 0) continue;
    const image = ctx.getImageData(x,y,w,h), p = image.data;
    for (let i=0; i<p.length; i+=4) {
      const [hue,sat,light] = rgbToHsl(p[i],p[i+1],p[i+2]);
      const distance = Math.min(Math.abs(hue-oldHue), 360-Math.abs(hue-oldHue));
      if (sat < .20 || light < .15 || light > .9 || distance > 23) continue;
      const [r,g,b] = hslToRgb(newHue, Math.max(.55, Math.min(.9, newSat)), light);
      p[i]=r; p[i+1]=g; p[i+2]=b;
    }
    ctx.putImageData(image,x,y);
  }
}
// Keep the two colored speaker names neutral. Recover the text coverage from
// its original ink and background, then replace the ink pixels directly.
function blackenSpeakerName(ctx: CanvasRenderingContext2D, spec: { region: [number,number,number,number]; ink: [number,number,number]; background: [number,number,number] }, yScale: number) {
  const [rx,ry,rw,rh] = spec.region;
  const x = rx*2, y = Math.round(ry*2*yScale);
  const w = Math.min(ctx.canvas.width-x, rw*2), h = Math.min(ctx.canvas.height-y, Math.round(rh*2*yScale));
  const image = ctx.getImageData(x,y,w,h), p = image.data;
  const vector = spec.ink.map((v,i) => v-spec.background[i]);
  const lengthSquared = vector.reduce((sum,v) => sum+v*v, 0);
  for (let i=0; i<p.length; i+=4) {
    const alpha = Math.max(0, Math.min(1, p.slice(i,i+3).reduce((sum,v,c) => sum+(v-spec.background[c])*vector[c], 0)/lengthSquared));
    if (alpha < .09) continue;
    const error = Math.sqrt(vector.reduce((sum,v,c) => sum+(p[i+c]-(spec.background[c]+alpha*v))**2, 0));
    if (error > 40) continue;
    for (let c=0; c<3; c++) p[i+c] = Math.round(spec.background[c]*(1-alpha)+18*alpha);
  }
  ctx.putImageData(image,x,y);
}
function eventParts(value: string) {
  const m = value.match(/(?:(\d{4})[-/.年])?(\d{1,2})[-/.月](\d{1,2})(?:日)?/);
  if (!m) return { month: "活动", day: "日期", weekday: "", time: value.trim() || "请填写活动时间" };
  const month = String(Number(m[2])), day = String(Number(m[3]));
  let weekday = "";
  const year = m[1] ? Number(m[1]) : new Date().getFullYear();
  const d = new Date(year, Number(m[2])-1, Number(m[3]));
  if (d.getFullYear() === year && d.getMonth() === Number(m[2])-1 && d.getDate() === Number(m[3])) weekday = "周" + "日一二三四五六"[d.getDay()];
  let time = value.slice((m.index || 0) + m[0].length).replace(/^[\s，,、·—–-]+/, "").trim();
  const explicitWeekday = time.match(/周[日一二三四五六天]/);
  if (explicitWeekday) { weekday = explicitWeekday[0].replace("天", "日"); time = time.replace(explicitWeekday[0], "").trim(); }
  time = time.replace(/(上午|下午)?\s*(\d{1,2})点(?:(半)|(\d{1,2})分?)?/g, (_, meridiem: string, hourText: string, half: string, minuteText: string) => {
    let hour = Number(hourText);
    if (meridiem === "下午" && hour < 12) hour += 12;
    if (meridiem === "上午" && hour === 12) hour = 0;
    return `${String(hour).padStart(2,"0")}:${half ? "30" : String(minuteText || "0").padStart(2,"0")}`;
  }).trim();
  return { month, day, weekday, time: time || "时间待定" };
}
function addressLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number) {
  ctx.font = `600 ${fontSize}px Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const lines: string[] = [];
  for (const paragraph of text.trim().split(/\n+/)) {
    // Split after natural address breaks. `match` skipped isolated punctuation
    // or repeated suffix characters, which made some entered text disappear.
    const pieces = paragraph.split(/(?<=[省市区县镇路号座栋幢楼层，,、\s])/u).filter(Boolean);
    let row = "";
    for (const piece of pieces) {
      if (ctx.measureText(row + piece).width <= maxWidth) { row += piece; continue; }
      if (row) { lines.push(row.trim()); row = ""; }
      for (const char of piece) {
        if (row && ctx.measureText(row + char).width > maxWidth) { lines.push(row.trim()); row = ""; }
        row += char;
      }
    }
    if (row) lines.push(row.trim());
  }
  if (lines.join("").replace(/\s/gu, "") !== text.trim().replace(/\s/gu, "")) {
    throw new Error("地址排版未能保留全部文字，请检查地址后重试");
  }
  return lines;
}
export async function renderPoster(canvas: HTMLCanvasElement, data: PosterData) {
  const template = templateById(data.templateId);
  const ctx = canvas.getContext("2d", { alpha: false }); if (!ctx) throw new Error("浏览器不支持图片绘制");
  const [base, logo, qr, companyLogo] = await Promise.all([
    cached(`/templates/${template.id}.jpg?v=5`), load(data.logo), load(data.qr), cached(`/templates/${template.id}-company-logo.png?v=1`),
  ]);
  canvas.width = 2484; canvas.height = template.height * 2;
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  const accent = logo ? mainLogoColor(logo) : null;
  const yScale = template.height / template.sourceHeight;
  if (template.blackName) blackenSpeakerName(ctx, template.blackName, yScale);
  if (accent) await recolorFromPsd(ctx, template, accent);
  ctx.scale(2, 2*yScale);
  // Recompose both original-color marks as one aligned header pair.
  const [logoX, logoY, logoW, logoH] = template.logoBox;
  const [originalCompanyX, companyY, companyW, companyH] = template.companyBox;
  const companyCenter = template.companyBox[1] + companyH / 2;
  ctx.fillStyle = "#fff";
  ctx.fillRect(logoX-3, logoY-3, logoW+6, logoH+6);
  clearOriginalCompanyMark(ctx, template.companyBox, yScale);
  let lawW = 0;
  if (logo) {
    const targetH = Math.min(logoH, Math.max(58, companyH * 1.25));
    lawW = drawTrimmedLogo(ctx, logo, logoX, companyCenter - targetH / 2, Math.min(logoW,originalCompanyX-logoX-18), targetH);
  } else {
    ctx.fillStyle = "#8b929b"; ctx.font = '600 25px Arial, "PingFang SC", sans-serif'; ctx.fillText("上传律所 Logo", logoX + 4, logoY + logoH / 2);
    lawW = Math.min(logoW,250);
  }
  const companyX = Math.min(originalCompanyX,logoX+lawW+22);
  ctx.drawImage(companyLogo, companyX, companyY, companyW, companyH);
  // A shared footer grid is drawn at final resolution for all five speakers.
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 2145, 1242, 430);
  const color = accent || template.defaultAccent;
  const date = eventParts(data.eventTime);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#09090b"; ctx.font = '900 168px Arial, "PingFang SC", sans-serif';
  const monthX = 98, dateBaseY = 2367;
  ctx.fillText(date.month, monthX, dateBaseY);
  const monthWidth = ctx.measureText(date.month).width;
  const dotX = monthX + monthWidth + 18;
  ctx.beginPath(); ctx.arc(dotX, 2305, 14, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(date.day, dotX + 35, dateBaseY);
  ctx.fillStyle = "#09090b"; ctx.font = '400 82px Arial, sans-serif';
  ctx.fillText("/", 535, 2364);
  ctx.font = '500 36px Arial, "PingFang SC", sans-serif';
  ctx.fillText(date.weekday || "", 605, 2317);
  ctx.font = '500 37px Arial, "PingFang SC", sans-serif';
  ctx.fillText(date.time, 605, 2366, 220);
  ctx.fillStyle = color; ctx.fillRect(99, 2428, 12, 129);
  ctx.fillStyle = "#111"; ctx.font = '700 30px Arial, "PingFang SC", sans-serif';
  ctx.fillText("培训地址：", 144, 2447);
  let size = 31, lines = addressLines(ctx, data.address || "请填写培训地址", 650, size);
  while (lines.length > 3 && size > 22) { size -= 2; lines = addressLines(ctx, data.address || "请填写培训地址", 650, size); }
  if (lines.length > 3) throw new Error("地址过长，三行仍放不下；请精简地址后生成");
  ctx.fillStyle = "#111"; ctx.font = `500 ${size}px Arial, "PingFang SC", sans-serif`;
  lines.forEach((line, index) => ctx.fillText(line, 144, 2487 + index * 36));
  const qx = 854, qy = 2162, qw = 289;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(qx, qy, qw, qw, 42); ctx.fill();
  ctx.strokeStyle = "#bcbcbc"; ctx.lineWidth = 2.5; ctx.stroke();
  if (qr) contain(ctx, qr, qx + 20, qy + 20, qw - 40, qw - 40);
  else {
    ctx.fillStyle = "#68717d"; ctx.textAlign = "center"; ctx.font = '700 38px Arial, "PingFang SC", sans-serif';
    ctx.fillText("待上传", qx + qw / 2, qy + qw / 2 + 13); ctx.textAlign = "start";
  }
  ctx.textAlign = "center";
  ctx.fillStyle = color; ctx.font = '500 29px Arial, "PingFang SC", sans-serif';
  ctx.fillText("扫码进群，免费报名", qx + qw/2, 2501);
  ctx.textAlign = "start";
  ctx.fillStyle = "#111"; ctx.font = '500 29px Arial, "PingFang SC", sans-serif';
  ctx.fillText("领取", 856, 2546);
  ctx.fillStyle = color; ctx.font = 'italic 900 43px Arial, sans-serif';
  ctx.fillText("10", 925, 2548);
  ctx.fillStyle = "#111"; ctx.font = '500 29px Arial, "PingFang SC", sans-serif';
  ctx.fillText("天免费试用", 985, 2546);
}
