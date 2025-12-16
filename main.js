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

  // WebGL Canvas (same as before)
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

  // Your shader, adapted to WebGL1
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
		q.x = q.x + sin(q.y * 19.0 + t * 2.0 + i) * 
			  29.0 * smoothstep(0.0, -2.0, q.y);

		float d = length(q - vec2(cos(a), sin(a)) * 
						 (0.4 * smoothstep(0.0, 0.5, -q.y)));

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

// --- EXIF Metadata Remover (client-side, no upload) ---
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

  function showInfo(text){ fileInfo.textContent = text; }

  fileEl.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    loadedBlob = f;
    const url = URL.createObjectURL(f);
    
    // Mostrar imagem original
    origImage.src = url;
    origImage.onload = () => {
      showInfo(`✓ Imagem carregada: ${f.name} (${Math.round(f.size/1024)} KB)`);
      removeBtn.disabled = false;
    };
    
    origImage.onerror = () => {
      showInfo('❌ Erro ao carregar a imagem');
    };
  });

  function scanMetadata(){
    if (!loadedBlob) { showInfo('Selecione uma imagem primeiro.'); return; }
    
    showInfo('Escaneando metadados...');
    
    // Try to detect basic EXIF presence
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);
      const hasExif = arr.some((v, i, a) => v === 0xFF && a[i+1] === 0xE1);
      
      // Build metadata display
      const metaItems = [];
      if (hasExif) {
        metaItems.push('📍 Localização GPS (possível)');
        metaItems.push('📅 Data e hora da foto');
        metaItems.push('📱 Modelo da câmera/dispositivo');
        metaItems.push('⚙️ Configurações de ISO, velocidade, foco');
        metaItems.push('🏢 Informações do software');
      } else {
        metaItems.push('✓ Nenhum metadado EXIF detectado nesta imagem');
      }
      
      metadataList.innerHTML = metaItems.map(item => `<div class="metadata-item">${item}</div>`).join('');
      
      removeBtn.disabled = false;
      showInfo('✓ Metadados escaneados. Clique "Remover e baixar" para processar.');
    };
    reader.readAsArrayBuffer(loadedBlob.slice(0, 8192));
  }

  function removeExifAndDownload(){
    if (!loadedBlob) { showInfo('Selecione uma imagem primeiro.'); return; }
    
    showInfo('Processando imagem...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      // Criar uma imagem a partir do blob
      const img = new Image();
      img.onload = () => {
        // Usar canvas para remover EXIF (canvas não preserva metadados)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Converter canvas para blob
        canvas.toBlob(blob => {
          if (!blob) { showInfo('Erro ao processar imagem.'); return; }
          
          // Free old URL
          if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
          lastBlobUrl = URL.createObjectURL(blob);
          
          // Mostrar imagem limpa
          cleanImage.src = lastBlobUrl;
          
          // Auto-download
          const link = document.createElement('a');
          link.href = lastBlobUrl;
          link.download = `${loadedBlob.name.split('.')[0]}-clean.jpg`;
          link.click();
          
          // Show download button
          downloadClean.href = lastBlobUrl;
          downloadClean.download = link.download;
          downloadClean.classList.remove('hidden');
          
          const origSize = loadedBlob.size;
          const cleanSize = blob.size;
          const saved = origSize - cleanSize;
          const savedPercent = Math.round(saved / origSize * 100);
          showInfo(`✓ Metadados removidos! ${Math.round(cleanSize/1024)} KB (economizados ${Math.round(saved/1024)} KB, ${savedPercent}%)`);
        }, 'image/jpeg', 0.95);
      };
      
      img.src = URL.createObjectURL(loadedBlob);
    };
    
    reader.readAsArrayBuffer(loadedBlob);
  }

  scanBtn.addEventListener('click', scanMetadata);
  removeBtn.addEventListener('click', removeExifAndDownload);
})();