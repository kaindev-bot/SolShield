(() => {
  // Navigation Toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  // Smooth scroll for nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href');
      if (target && target.startsWith('#')) {
        const section = document.querySelector(target);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
          navMenu.classList.remove('active');
        }
      }
    });
  });

  // WebGL Canvas
  const canvas = document.getElementById("glcanvas");
  const gl = canvas.getContext("webgl");
  const errEl = document.getElementById("err");

  function resize() {
    const d = window.devicePixelRatio || 1;
    canvas.width = innerWidth * d;
    canvas.height = innerHeight * d;
    canvas.style.width = innerWidth+"px";
    canvas.style.height = innerHeight+"px";
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  resize();
  addEventListener("resize", resize);

  const vert = `
    attribute vec2 pos;
    void main() {
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const frag = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_speed;

    void main() {
      vec2 FC = gl_FragCoord.xy;
      float t = u_time * u_speed;
      vec2 r = u_res;
      vec2 p = (FC * 2.0 - r) / r.y;
      vec3 c = vec3(0.0);

      for (float i = 0.0; i < 42.0; i++) {
        float a = i / 1.5 + t * 0.5;
        vec2 q = p;
        q.x = q.x + sin(q.y * 19.0 + t * 2.0 + i) * 29.0 * smoothstep(0.0, -2.0, q.y);
        float d = length(q - vec2(cos(a), sin(a)) * (0.4 * smoothstep(0.0, 0.5, -q.y)));
        c = c + vec3(0.34, 0.30, 0.24) * (0.015 / d);
      }
      vec3 col = c * c + 0.05;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(s);
      throw new Error(msg);
    }
    return s;
  }

  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  let program;
  try {
    const vs = compile(vert, gl.VERTEX_SHADER);
    const fs = compile(frag, gl.FRAGMENT_SHADER);
    program = link(vs, fs);
  } catch (e) {
    errEl.style.display = "block";
    errEl.textContent = e.message;
    console.error(e);
    return;
  }

  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,   3,-1,   -1,3
  ]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const u_res   = gl.getUniformLocation(program, "u_res");
  const u_time  = gl.getUniformLocation(program, "u_time");
  const u_speed = gl.getUniformLocation(program, "u_speed");

  let start = performance.now();

  function draw() {
    const now = performance.now();
    const t = (now - start) * 0.001;
    gl.uniform2f(u_res, canvas.width, canvas.height);
    gl.uniform1f(u_time, t);
    gl.uniform1f(u_speed, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(draw);
  }

  draw();
})();

// ===== EXIF METADATA REMOVER =====
(function(){
  const fileEl = document.getElementById('imgfile');
  const scanBtn = document.getElementById('scanBtn');
  const removeBtn = document.getElementById('removeBtn');
  const origImage = document.getElementById('origImage');
  const cleanImage = document.getElementById('cleanImage');
  const fileInfo = document.getElementById('fileInfo');
  const metadataList = document.getElementById('metadataList');
  const downloadClean = document.getElementById('downloadClean');

  let loadedBlob = null;
  let lastBlobUrl = null;

  function showInfo(text) { 
    fileInfo.textContent = text; 
    console.log(text);
  }

  // ===== FILE UPLOAD =====
  fileEl.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    loadedBlob = f;
    const url = URL.createObjectURL(f);
    
    origImage.src = url;
    origImage.onload = () => {
      showInfo(`✓ Imagem carregada: ${f.name} (${Math.round(f.size/1024)} KB)`);
      removeBtn.disabled = false;
    };
    
    origImage.onerror = () => {
      showInfo('❌ Erro ao carregar a imagem');
    };
  });

  // ===== SCAN METADATA =====
  function scanMetadata(){
    if (!loadedBlob) { 
      showInfo('Selecione uma imagem primeiro.'); 
      return; 
    }
    
    showInfo('🔍 Escaneando metadados em detalhes...');
    
    // Verificar se piexif está disponível ANTES de ler o arquivo
    if (typeof piexif === 'undefined') {
      console.error('⚠️ piexif não está carregado ainda. Aguardando...');
      // Tentar carregar de novo
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/piexifjs';
      script.onload = () => {
        console.log('✓ piexif carregado com sucesso');
        scanMetadata(); // Tentar de novo
      };
      script.onerror = () => {
        showInfo('❌ Erro ao carregar a biblioteca de EXIF. Tente novamente.');
        console.error('Falha ao carregar piexif');
      };
      document.head.appendChild(script);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binary = e.target.result;
        const exifData = piexif.load(binary);
        console.log('=== EXIF CARREGADO COM SUCESSO ===', exifData);
        
        const metaItems = [];
        let hasData = false;
        
        // ===== GPS =====
        if (exifData['GPS'] && Object.keys(exifData['GPS']).length > 0) {
          const gps = exifData['GPS'];
          
          if (gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLongitude]) {
            hasData = true;
            
            const lat = gps[piexif.GPSIFD.GPSLatitude];
            const latValue = (lat[0][0] / lat[0][1]) + (lat[1][0] / lat[1][1]) / 60 + (lat[2][0] / lat[2][1]) / 3600;
            const latRef = gps[piexif.GPSIFD.GPSLatitudeRef] ? String.fromCharCode(gps[piexif.GPSIFD.GPSLatitudeRef]) : 'N';
            metaItems.push(`📍 <strong>🚨 GPS LATITUDE:</strong> ${latValue.toFixed(6)}° ${latRef}`);
            
            const lng = gps[piexif.GPSIFD.GPSLongitude];
            const lngValue = (lng[0][0] / lng[0][1]) + (lng[1][0] / lng[1][1]) / 60 + (lng[2][0] / lng[2][1]) / 3600;
            const lngRef = gps[piexif.GPSIFD.GPSLongitudeRef] ? String.fromCharCode(gps[piexif.GPSIFD.GPSLongitudeRef]) : 'E';
            metaItems.push(`📍 <strong>🚨 GPS LONGITUDE:</strong> ${lngValue.toFixed(6)}° ${lngRef}`);
          }
          
          if (gps[piexif.GPSIFD.GPSAltitude]) {
            hasData = true;
            const alt = gps[piexif.GPSIFD.GPSAltitude];
            const altValue = (alt[0] / alt[1]).toFixed(2);
            metaItems.push(`⛰️ <strong>GPS ALTITUDE:</strong> ${altValue}m`);
          }
          
          if (gps[piexif.GPSIFD.GPSTimeStamp]) {
            hasData = true;
            const time = gps[piexif.GPSIFD.GPSTimeStamp];
            const h = Math.floor(time[0][0]/time[0][1]);
            const m = Math.floor(time[1][0]/time[1][1]);
            const s = Math.floor(time[2][0]/time[2][1]);
            metaItems.push(`⏰ <strong>GPS TIMESTAMP:</strong> ${h}:${m}:${s} UTC`);
          }
        }
        
        // ===== IMAGE INFO (0TH IFD) =====
        if (exifData['0th'] && Object.keys(exifData['0th']).length > 0) {
          const exif0 = exifData['0th'];
          
          if (exif0[piexif.ImageIFD.DateTime]) {
            hasData = true;
            metaItems.push(`📅 <strong>Data/Hora (Modificada):</strong> ${exif0[piexif.ImageIFD.DateTime].toString()}`);
          }
          
          if (exif0[piexif.ImageIFD.Make]) {
            hasData = true;
            metaItems.push(`🏭 <strong>Fabricante da Câmera:</strong> ${exif0[piexif.ImageIFD.Make].toString()}`);
          }
          
          if (exif0[piexif.ImageIFD.Model]) {
            hasData = true;
            metaItems.push(`📱 <strong>Modelo da Câmera:</strong> ${exif0[piexif.ImageIFD.Model].toString()}`);
          }
          
          if (exif0[piexif.ImageIFD.Software]) {
            hasData = true;
            metaItems.push(`💻 <strong>Software/App Usado:</strong> ${exif0[piexif.ImageIFD.Software].toString()}`);
          }
          
          if (exif0[piexif.ImageIFD.Orientation]) {
            hasData = true;
            const orientations = ['Normal', 'Espelhado Horizontal', 'Rotacionado 180°', 'Espelhado Vertical', 'Espelhado + Rotação', 'Rotado 90° CW', 'Espelhado + Rotação', 'Rotado 90° CCW'];
            const orient = exif0[piexif.ImageIFD.Orientation][0];
            metaItems.push(`🔄 <strong>Orientação:</strong> ${orientations[orient - 1] || 'Desconhecida'}`);
          }
          
          if (exif0[piexif.ImageIFD.ImageWidth]) {
            hasData = true;
            const w = exif0[piexif.ImageIFD.ImageWidth][0];
            metaItems.push(`📐 <strong>Largura:</strong> ${w}px`);
          }
          
          if (exif0[piexif.ImageIFD.ImageLength]) {
            hasData = true;
            const h = exif0[piexif.ImageIFD.ImageLength][0];
            metaItems.push(`📐 <strong>Altura:</strong> ${h}px`);
          }
        }
        
        // ===== PHOTO SETTINGS (EXIF IFD) =====
        if (exifData['Exif'] && Object.keys(exifData['Exif']).length > 0) {
          const exif1 = exifData['Exif'];
          
          if (exif1[piexif.ExifIFD.DateTimeOriginal]) {
            hasData = true;
            metaItems.push(`🕐 <strong>Data/Hora Original (Captura):</strong> ${exif1[piexif.ExifIFD.DateTimeOriginal].toString()}`);
          }
          
          if (exif1[piexif.ExifIFD.ISOSpeedRatings]) {
            hasData = true;
            const iso = exif1[piexif.ExifIFD.ISOSpeedRatings][0];
            metaItems.push(`📊 <strong>ISO:</strong> ${iso}`);
          }
          
          if (exif1[piexif.ExifIFD.FNumber]) {
            hasData = true;
            const fn = exif1[piexif.ExifIFD.FNumber];
            const fvalue = (fn[0] / fn[1]).toFixed(1);
            metaItems.push(`📸 <strong>Abertura (F-number):</strong> f/${fvalue}`);
          }
          
          if (exif1[piexif.ExifIFD.ExposureTime]) {
            hasData = true;
            const exp = exif1[piexif.ExifIFD.ExposureTime];
            const expValue = exp[0] / exp[1];
            const expStr = expValue < 1 ? `1/${Math.round(1/expValue)}s` : `${expValue.toFixed(2)}s`;
            metaItems.push(`⏱️ <strong>Velocidade Obturador:</strong> ${expStr}`);
          }
          
          if (exif1[piexif.ExifIFD.FocalLength]) {
            hasData = true;
            const focal = exif1[piexif.ExifIFD.FocalLength];
            const focalValue = (focal[0] / focal[1]).toFixed(1);
            metaItems.push(`🎯 <strong>Distância Focal:</strong> ${focalValue}mm`);
          }
          
          if (exif1[piexif.ExifIFD.Flash]) {
            hasData = true;
            const flashStates = ['Não disparou', 'Disparou', 'Flash desativado', 'Flash desativado retorno', 'Disparou retorno'];
            const flash = exif1[piexif.ExifIFD.Flash][0];
            metaItems.push(`⚡ <strong>Flash:</strong> ${flashStates[flash] || 'Desconhecido'}`);
          }
          
          if (exif1[piexif.ExifIFD.WhiteBalance]) {
            hasData = true;
            const wb = exif1[piexif.ExifIFD.WhiteBalance][0];
            metaItems.push(`🎨 <strong>Balanço de Branco:</strong> ${wb === 0 ? 'Auto' : 'Manual'}`);
          }
          
          if (exif1[piexif.ExifIFD.ExposureProgram]) {
            hasData = true;
            const programs = ['Não definido', 'Manual', 'Programa Normal', 'Prioridade Abertura', 'Prioridade Obturador', 'Criativo', 'Ação', 'Retrato', 'Paisagem'];
            const prog = exif1[piexif.ExifIFD.ExposureProgram][0];
            metaItems.push(`🎬 <strong>Modo de Exposição:</strong> ${programs[prog] || 'Desconhecido'}`);
          }
          
          if (exif1[piexif.ExifIFD.MeteringMode]) {
            hasData = true;
            const modes = ['Desconhecido', 'Média', 'Ponderado Centro', 'Spot', 'Multi-Spot', 'Pattern', 'Parcial'];
            const mode = exif1[piexif.ExifIFD.MeteringMode][0];
            metaItems.push(`📊 <strong>Modo de Medição:</strong> ${modes[mode] || 'Desconhecido'}`);
          }
          
          if (exif1[piexif.ExifIFD.BrightnessValue]) {
            hasData = true;
            const bright = exif1[piexif.ExifIFD.BrightnessValue];
            const brightVal = (bright[0] / bright[1]).toFixed(2);
            metaItems.push(`☀️ <strong>Brilho:</strong> ${brightVal} EV`);
          }
          
          if (exif1[piexif.ExifIFD.ExposureBiasValue]) {
            hasData = true;
            const bias = exif1[piexif.ExifIFD.ExposureBiasValue];
            const biasVal = (bias[0] / bias[1]).toFixed(2);
            metaItems.push(`🔆 <strong>Correção de Exposição:</strong> ${biasVal} EV`);
          }
          
          if (exif1[piexif.ExifIFD.ColorSpace]) {
            hasData = true;
            const cs = exif1[piexif.ExifIFD.ColorSpace][0];
            metaItems.push(`🌈 <strong>Espaço de Cores:</strong> ${cs === 1 ? 'sRGB' : 'Uncalibrated'}`);
          }
          
          if (exif1[piexif.ExifIFD.LensModel]) {
            hasData = true;
            metaItems.push(`🔍 <strong>Modelo da Lente:</strong> ${exif1[piexif.ExifIFD.LensModel].toString()}`);
          }
          
          if (exif1[piexif.ExifIFD.LensMake]) {
            hasData = true;
            metaItems.push(`🔧 <strong>Fabricante da Lente:</strong> ${exif1[piexif.ExifIFD.LensMake].toString()}`);
          }
        }
        
        // Display results
        if (metaItems.length === 0) {
          metaItems.push('✓ Nenhum metadado EXIF detectado nesta imagem');
        }
        
        metadataList.innerHTML = metaItems.map(item => `<div class="metadata-item">${item}</div>`).join('');
        
        removeBtn.disabled = false;
        if (hasData) {
          showInfo(`✓ 🎯 ${metaItems.length} DADOS ENCONTRADOS! Revise abaixo e clique "Remover e baixar".`);
        } else {
          showInfo('✓ Nenhum metadado encontrado. Sua imagem está segura.');
        }
        
      } catch (err) {
        console.error('Erro ao ler EXIF:', err);
        metadataList.innerHTML = '<div class="metadata-item">✓ Nenhum metadado EXIF detectado ou erro ao ler arquivo</div>';
        removeBtn.disabled = false;
        showInfo('✓ Arquivo analisado. Clique "Remover e baixar" para processar.');
      }
    };
    
    try {
      reader.readAsArrayBuffer(loadedBlob);
    } catch (err) {
      console.error('Erro ao ler arquivo:', err);
      showInfo('❌ Erro ao ler o arquivo. Tente novamente.');
    }
  }

  // ===== REMOVE EXIF =====
  function removeExifAndDownload(){
    if (!loadedBlob) { 
      showInfo('Selecione uma imagem primeiro.'); 
      return; 
    }
    
    showInfo('⏳ Processando imagem...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(blob => {
          if (!blob) { 
            showInfo('Erro ao processar imagem.'); 
            return; 
          }
          
          if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
          lastBlobUrl = URL.createObjectURL(blob);
          
          cleanImage.src = lastBlobUrl;
          
          const link = document.createElement('a');
          link.href = lastBlobUrl;
          link.download = `${loadedBlob.name.split('.')[0]}-clean.jpg`;
          link.click();
          
          downloadClean.href = lastBlobUrl;
          downloadClean.download = link.download;
          downloadClean.classList.remove('hidden');
          
          const saved = loadedBlob.size - blob.size;
          const savedPercent = Math.round(saved / loadedBlob.size * 100);
          showInfo(`✅ METADADOS REMOVIDOS! ${Math.round(blob.size/1024)} KB (economizados ${Math.round(saved/1024)} KB, ${savedPercent}%)`);
        }, 'image/jpeg', 0.95);
      };
      
      img.src = URL.createObjectURL(loadedBlob);
    };
    
    reader.readAsArrayBuffer(loadedBlob);
  }

  scanBtn.addEventListener('click', scanMetadata);
  removeBtn.addEventListener('click', removeExifAndDownload);
})();
