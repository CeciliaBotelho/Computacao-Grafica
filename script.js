const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

gl.viewport(0, 0, canvas.width, canvas.height);

gl.clearColor(1.0, 1.0, 1.0, 1.0); 

const ext = gl.getExtension('ANGLE_instanced_arrays');
if (!ext) {
  alert('Instanced arrays não suportado!');
}

let modelVertexBuffer = {};
let program = null;
let vertexCounts = {};

let cameraAngleX = 0;
let cameraAngleY = 0;
let cameraDistance = 10;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let selectedModelIndex = null;
let selectedTextureIndex = null
let rotationAngle = 0;

let lastInstanceData = {
  position: null,
  scale: null,
  rotation: null
};

let projectionMatrix = mat4.create();
let viewMatrix = mat4.create();

let instanceBuffers = {
  position: null,
  scale: null,
  rotation: null
};

const scene = [];

const models = {
  Cadeira: './assets/models/Chair.obj',
  Mesa: './assets/models/Table.obj',
  Balcão: './assets/models/Counter.obj',
};

const textures = {
  Madeira: './assets/models/woodfloortexture.png',
  Pedra: './assets/models/stone.png',
  Concreto: './assets/models/concreto.png',
  Tecido: './assets/models/tecido.png',
};


function populateList(elementId, items, onClickCallback) {
  const list = document.getElementById(elementId);
  if (!list) {
    console.error(`Elemento ${elementId} não encontrado no DOM.`);
    return;
  }

  list.innerHTML = ''; 
  Object.keys(items).forEach((name, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = name;
    listItem.onclick = () => {
      selectedTextureIndex = index
      onClickCallback(name)
    }
    list.appendChild(listItem);
  });
}


function populateModelList() {
  const modelList = document.getElementById('modelList');
  if (!modelList) {
    console.error('Elemento modelList não encontrado no DOM.');
    return;
  }

  modelList.innerHTML = ''; 

  Object.keys(models).forEach(modelName => {
    const listItem = document.createElement('li');
    listItem.classList.add('model-item');

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 100;
    previewCanvas.height = 100;
    listItem.appendChild(previewCanvas);

    renderRotatingModelPreview(previewCanvas, models[modelName], textures['Madeira']);

    listItem.onclick = () => addModelToScene(modelName);
    modelList.appendChild(listItem);
  });
}


function renderRotatingModelPreview(canvas, modelPath, texturePath) {
  const glPreview = canvas.getContext('webgl');
  if (!glPreview) {
    console.error('WebGL não suportado para miniaturas.');
    return;
  }

  glPreview.viewport(0, 0, canvas.width, canvas.height);
  glPreview.clearColor(1.0, 1.0, 1.0, 1.0);
  glPreview.clear(glPreview.COLOR_BUFFER_BIT | glPreview.DEPTH_BUFFER_BIT);
  glPreview.enable(glPreview.DEPTH_TEST);

  loadOBJ(modelPath).then(vertices => {
    if (!vertices || vertices.length === 0) {
      console.error('Falha ao carregar o modelo:', modelPath);
      return;
    }

    const buffer = glPreview.createBuffer();
    glPreview.bindBuffer(glPreview.ARRAY_BUFFER, buffer);
    glPreview.bufferData(glPreview.ARRAY_BUFFER, vertices, glPreview.STATIC_DRAW);

    const vertexShaderSource = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      uniform mat4 uProjection;
      uniform mat4 uModelView;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = uProjection * uModelView * vec4(aPosition * 0.5, 1.0);
        vTexCoord = aTexCoord;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uSampler;
      void main() {
        vec4 texColor = texture2D(uSampler, vTexCoord);
        if (texColor.a < 0.1) {
          discard;  // Remove transparências
        }
        gl_FragColor = texColor;
      }
    `;

    const vertexShader = createShader(glPreview, glPreview.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(glPreview, glPreview.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(glPreview, vertexShader, fragmentShader);
    glPreview.useProgram(program);

    const positionLocation = glPreview.getAttribLocation(program, 'aPosition');
    glPreview.enableVertexAttribArray(positionLocation);
    glPreview.vertexAttribPointer(positionLocation, 3, glPreview.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);

    const texCoordLocation = glPreview.getAttribLocation(program, 'aTexCoord');
    glPreview.enableVertexAttribArray(texCoordLocation);
    glPreview.vertexAttribPointer(texCoordLocation, 2, glPreview.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10);
    glPreview.uniformMatrix4fv(glPreview.getUniformLocation(program, 'uProjection'), false, projectionMatrix);

    const texture = glPreview.createTexture();
    glPreview.bindTexture(glPreview.TEXTURE_2D, texture);
    glPreview.texParameteri(glPreview.TEXTURE_2D, glPreview.TEXTURE_MIN_FILTER, glPreview.LINEAR);
    glPreview.texParameteri(glPreview.TEXTURE_2D, glPreview.TEXTURE_MAG_FILTER, glPreview.LINEAR);

    const image = new Image();
    image.src = texturePath;
    image.onload = () => {
      glPreview.bindTexture(glPreview.TEXTURE_2D, texture);
      glPreview.texImage2D(glPreview.TEXTURE_2D, 0, glPreview.RGBA, glPreview.RGBA, glPreview.UNSIGNED_BYTE, image);
      glPreview.generateMipmap(glPreview.TEXTURE_2D);
    };

    glPreview.uniform1i(glPreview.getUniformLocation(program, 'uSampler'), 0);

    let rotationAngle = 0;
    function animate() {
      glPreview.clear(glPreview.COLOR_BUFFER_BIT | glPreview.DEPTH_BUFFER_BIT);

      const modelViewMatrix = mat4.create();
      mat4.lookAt(modelViewMatrix, 
        [Math.sin(rotationAngle) * 2, 1, Math.cos(rotationAngle) * 2], 
        [0, 0, 0], 
        [0, 1, 0]
      );

      glPreview.uniformMatrix4fv(glPreview.getUniformLocation(program, 'uModelView'), false, modelViewMatrix);
      glPreview.drawArrays(glPreview.TRIANGLES, 0, vertices.length / 5);

      rotationAngle += 0.02; 
      requestAnimationFrame(animate);
    }

    animate();
  });
}

function updateInstanceBuffers() {
  const instancePositions = new Float32Array(scene.flatMap(obj => obj.position));
  const instanceScales = new Float32Array(scene.map(obj => obj.scale));
  const instanceRotations = new Float32Array(scene.map(obj => obj.rotationY));
  
  const instanceTextureIndices = new Float32Array(scene.map(obj => {
    return Object.keys(textures).indexOf(obj.textureName);
  }));

  updateBuffer(instanceBuffers.position, instancePositions, 'position', 'aInstancePosition', 3);
  updateBuffer(instanceBuffers.scale, instanceScales, 'scale', 'aInstanceScale', 1);
  updateBuffer(instanceBuffers.rotation, instanceRotations, 'rotation', 'aInstanceRotationY', 1);
  updateBuffer(instanceBuffers.textureIndex, instanceTextureIndices, 'textureIndex', 'aTextureIndex', 1);
}

function updateSceneModelList() {
  const sceneModelList = document.getElementById('sceneModelList');
  sceneModelList.innerHTML = ''; 

  scene.forEach((object, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = `${object.model} ${index}`;
    
    listItem.addEventListener('click', () => selectModelInScene(index));

    sceneModelList.appendChild(listItem);
  });
}

function selectModelInScene(index) {
  selectedModelIndex = index;
  const selectedModel = scene[index];

  document.getElementById('translateX').value = selectedModel.position[0].toFixed(2);
  document.getElementById('translateY').value = selectedModel.position[1].toFixed(2);
  document.getElementById('translateZ').value = selectedModel.position[2].toFixed(2);
  document.getElementById('scale').value = selectedModel.scale.toFixed(2);
  document.getElementById('rotateY').value = selectedModel.rotationY.toFixed(2);

}

function applyTexture(textureName) {
  if (selectedModelIndex === null) {
    alert("Selecione um modelo primeiro!");
    return;
  }

  const selectedModel = scene[selectedModelIndex];

  selectedModel.textureName = textureName;
  selectedModel.textureIndex = Object.keys(textures).indexOf(textureName); // Certifique-se de que este índice está correto
  selectedModel.texture = loadTexture(textures[textureName]);

  updateInstanceBuffers();
  renderSceneInstanced();
}

function updateModelProperties() {
  if (selectedModelIndex === null) {
    alert('Selecione um modelo primeiro!');
    return;
  }

  const selectedModel = scene[selectedModelIndex];

  // Atualiza posição, escala e rotação
  selectedModel.position[0] = parseFloat(document.getElementById('translateX').value);
  selectedModel.position[1] = parseFloat(document.getElementById('translateY').value);
  selectedModel.position[2] = parseFloat(document.getElementById('translateZ').value);
  selectedModel.scale = parseFloat(document.getElementById('scale').value);
  selectedModel.rotationY = parseFloat(document.getElementById('rotateY').value);

  // Atualiza a textura apenas se uma nova textura foi selecionada
  if (selectedTextureIndex !== null) {
    const textureName = Object.keys(textures)[selectedTextureIndex]; 
    const texturePath = textures[textureName];
    selectedModel.textureName = textureName;
    selectedModel.texture = loadTexture(texturePath);
  }
  // Atualiza os buffers e re-renderiza a cena
  updateInstanceBuffers();
  renderSceneInstanced();
}

function initializeInstanceBuffers() {
  ["position", "scale", "rotation", "textureIndex"].forEach(attr => {
    instanceBuffers[attr] = gl.createBuffer();
  });
}

function initializeShaders() {
  const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;
  attribute vec3 aInstancePosition;
  attribute float aInstanceScale;
  attribute float aInstanceRotationY;
  attribute float aTextureIndex; // Índice da textura manual

  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;

  varying vec2 vTexCoord;
  varying float vTextureIndex; // Passa o índice da textura para o fragment shader

  void main() {
    float angle = radians(aInstanceRotationY);
    mat4 rotationMatrix = mat4(
      cos(angle), 0.0, sin(angle), 0.0,
      0.0, 1.0, 0.0, 0.0,
      -sin(angle), 0.0, cos(angle), 0.0,
      0.0, 0.0, 0.0, 1.0
    );
    mat4 scaleMatrix = mat4(
      aInstanceScale, 0.0, 0.0, 0.0,
      0.0, aInstanceScale, 0.0, 0.0,
      0.0, 0.0, aInstanceScale, 0.0,
      0.0, 0.0, 0.0, 1.0
    );
    mat4 modelMatrix = rotationMatrix * scaleMatrix;
    modelMatrix[3].xyz = aInstancePosition;

    vTexCoord = aTexCoord; 
    vTextureIndex = aTextureIndex; // Passa o índice para o fragment shader
    gl_Position = uProjectionMatrix * uViewMatrix * modelMatrix * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 vTexCoord;
  varying float vTextureIndex; 

  uniform sampler2D uTextures[4]; // Array com até 4 texturas

  void main() {
    int texIndex = int(vTextureIndex);
    vec4 color;

    if (texIndex == 0) {
      color = texture2D(uTextures[0], vTexCoord);
    } else if (texIndex == 1) {
      color = texture2D(uTextures[1], vTexCoord);
    } else if (texIndex == 2) {
      color = texture2D(uTextures[2], vTexCoord);
    } else {
      color = texture2D(uTextures[3], vTexCoord);
    }

    gl_FragColor = color;
  }
`;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  program = createProgram(gl, vertexShader, fragmentShader);
}


function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}


function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function loadTexture(url) {
  /*
  if (loadedTextures[url]) {
      return loadedTextures[url];
  }
  if (Object.keys(loadedTextures).length > 10) { // Limite de texturas armazenadas para liberar memória
      const oldKey = Object.keys(loadedTextures)[0];
      gl.deleteTexture(loadedTextures[oldKey]);
      delete loadedTextures[oldKey];
  }
  */

  const image = new Image();

  image.src = url;
  
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const placeholder = new Uint8Array([255, 255, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
  
  image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      //renderSceneInstanced();
  }; 
 
  //loadedTextures[url] = texture;

  return texture;
}

function renderSceneInstanced() {
  if (!program) {
    console.error("⚠ Programa WebGL não inicializado.");
    return;
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(program);

  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

  const cameraPosition = [
    cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX),
    cameraDistance * Math.sin(cameraAngleX),
    cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX),
  ];
  mat4.lookAt(viewMatrix, cameraPosition, [0, 0, 0], [0, 1, 0]);

  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, projectionMatrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);

  if (scene.length === 0) return;

  scene.sort((a, b) => a.position[2] - b.position[2]);

  const usedTextures = new Set();
  scene.forEach(obj => {
    usedTextures.add(obj.textureName || "Madeira"); // Se não tiver textura, usa madeira
  });

  const textureIndices = {};
  let textureUnit = 0;

  usedTextures.forEach(textureName => {
    textureIndices[textureName] = textureUnit;
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, loadTexture(textures[textureName]));
    textureUnit++;
  });

  gl.uniform1iv(gl.getUniformLocation(program, 'uTextures'), Object.values(textureIndices));

  Object.keys(modelVertexBuffer).forEach(modelName => {
    const instances = scene.filter(obj => obj.model === modelName);
    if (instances.length === 0) return;

    const instancePositions = new Float32Array(instances.flatMap(obj => obj.position));
    const instanceScales = new Float32Array(instances.map(obj => obj.scale));
    const instanceRotations = new Float32Array(instances.map(obj => obj.rotationY));

    const instanceTextureIndices = new Float32Array(
      instances.map(obj => textureIndices[obj.textureName || "Madeira"])
    );

    updateBuffer(instanceBuffers.position, instancePositions, 'position', 'aInstancePosition', 3);
    updateBuffer(instanceBuffers.scale, instanceScales, 'scale', 'aInstanceScale', 1);
    updateBuffer(instanceBuffers.rotation, instanceRotations, 'rotation', 'aInstanceRotationY', 1);
    updateBuffer(instanceBuffers.textureIndex, instanceTextureIndices, 'textureIndex', 'aTextureIndex', 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, modelVertexBuffer[modelName]);
    setupAttribute(program, 'aPosition', 3, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);
    setupAttribute(program, 'aTexCoord', 2, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);

    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, vertexCounts[modelName], instances.length);
  });
}

function updateBuffer(buffer, newData, key, attribute, size) {
  if (!arraysEqual(newData, lastInstanceData[key])) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, newData, gl.STATIC_DRAW);
    setupAttribute(program, attribute, size, gl.FLOAT, false, 0, 0, 1);
    lastInstanceData[key] = newData;
  }
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

function setupAttribute(program, attribute, size, type, normalize, stride, offset, divisor = 0) {
  const location = gl.getAttribLocation(program, attribute);
  if (location < 0) {
      console.warn(`Atributo ${attribute} não encontrado no shader.`);
      return;
  }
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, type, normalize, stride, offset);
  if (divisor > 0) {
      ext.vertexAttribDivisorANGLE(location, divisor);
  }
}


async function loadOBJ(url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Erro ao carregar o modelo ${url}: ${response.status}`);
    return null;
  }

  const text = await response.text();
  const vertices = [];
  const texCoords = [];
  const vertexData = [];

  text.split("\n").forEach(line => {
    if (!line.startsWith("v") && !line.startsWith("f")) return; 

    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return; 

    switch (parts[0]) {
      case "v": 
        vertices.push(...parts.slice(1, 4).map(parseFloat));
        break;

      case "vt": 
        texCoords.push(parseFloat(parts[1]), 1.0 - parseFloat(parts[2])); 
        break;

      case "f": 
        const face = parts.slice(1).map(p => p.split("/"));
        processFace(face, vertices, texCoords, vertexData);
        break;
    }
  });

  return new Float32Array(vertexData);
}

function processFace(face, vertices, texCoords, vertexData) {
  if (face.length === 3) {
    face.forEach(v => processVertex(v, vertices, texCoords, vertexData));
  } else if (face.length === 4) {
    processVertex(face[0], vertices, texCoords, vertexData);
    processVertex(face[1], vertices, texCoords, vertexData);
    processVertex(face[2], vertices, texCoords, vertexData);

    processVertex(face[0], vertices, texCoords, vertexData);
    processVertex(face[2], vertices, texCoords, vertexData);
    processVertex(face[3], vertices, texCoords, vertexData);
  }
}

function processVertex(vertex, vertices, texCoords, vertexData) {
  const vIndex = (parseInt(vertex[0]) - 1) * 3;
  const vtIndex = vertex[1] ? (parseInt(vertex[1]) - 1) * 2 : null;

  vertexData.push(vertices[vIndex], vertices[vIndex + 1], vertices[vIndex + 2]);

  if (vtIndex !== null) {
    vertexData.push(texCoords[vtIndex], texCoords[vtIndex + 1]);
  } else {
    vertexData.push(0, 0); 
  }
}

const loadedTextures = {};

function loadTexture(url) {
  if (!loadedTextures[url]) {  
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const placeholder = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);

    const image = new Image();
    image.src = url;
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      renderSceneInstanced();
    };

    loadedTextures[url] = texture;
  }

  return loadedTextures[url];  
}
async function addModelToScene(modelName) {
  
  if (!modelVertexBuffer[modelName]) {
    try {
      const vertices = await loadOBJ(models[modelName]);
      if (!vertices) {
        console.error(`Erro ao carregar o modelo: ${modelName}`);
        return;
      }

      modelVertexBuffer[modelName] = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, modelVertexBuffer[modelName]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      vertexCounts[modelName] = vertices.length / 5;
    } catch (error) {
      console.error(`Erro ao carregar o modelo ${modelName}:`, error);
      return;
    }
  }
  const spacing = 2.0;
  const numObjects = scene.length;
  const rowSize = 4;
  const x = (numObjects % rowSize) * spacing; 
  const z = -5 - Math.floor(numObjects / rowSize) * spacing; 

  const textureName = 'Madeira'
  const newObject = {
    model: modelName,
    position: [x, 0, z],
    scale: 1.0,
    rotationY: 0,
    textureName: textureName,
    texture: loadTexture(textures[textureName]) 
  };

  scene.push(newObject);
  console.log(newObject)

  updateSceneModelList();
  renderSceneInstanced();
}


function updateSceneModelList() {
  const sceneModelList = document.getElementById('sceneModelList');
  sceneModelList.innerHTML = ''; 

  scene.forEach((object, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = `${object.model} ${index}`;
    listItem.addEventListener('click', () => selectModelInScene(index));

    sceneModelList.appendChild(listItem);
  });
}

function selectModelInScene(index) {
  selectedModelIndex = index;
  const selectedModel = scene[index];

  document.getElementById('translateX').value = selectedModel.position[0].toFixed(2);
  document.getElementById('translateY').value = selectedModel.position[1].toFixed(2);
  document.getElementById('translateZ').value = selectedModel.position[2].toFixed(2);
  document.getElementById('scale').value = selectedModel.scale.toFixed(2);
  document.getElementById('rotationY').value = selectedModel.rotationY.toFixed(2);

  document.querySelectorAll('#sceneModelList li').forEach(li => li.classList.remove('selected'));
  document.querySelector(`#sceneModelList li:nth-child(${index + 1})`).classList.add('selected');
}


canvas.addEventListener('mousedown', (event) => {
  isDragging = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mousemove', (event) => {
  if (!isDragging) return;

  const deltaX = event.clientX - lastMouseX;
  const deltaY = event.clientY - lastMouseY;

  cameraAngleY += deltaX * 0.005; 
  cameraAngleX += deltaY * 0.005;

  cameraAngleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleX));

  lastMouseX = event.clientX;
  lastMouseY = event.clientY;

  renderSceneInstanced();
});


canvas.addEventListener('wheel', (event) => {
  cameraDistance += event.deltaY * 0.01;
  cameraDistance = Math.max(5, Math.min(50, cameraDistance)); // Limite de zoom
  renderSceneInstanced();
});

document.addEventListener("DOMContentLoaded", () => {
  populateModelList();  // Gera a lista de modelos disponíveis
  populateList('textureList', textures, applyTexture); // Gera a lista de texturas disponíveis

  initializeInstanceBuffers(); 
  initializeShaders();  
  renderSceneInstanced();  
});



function saveSceneToJson() {
  if (!scene.length) {
    console.error("A cena está vazia. Nada para salvar.");
    return;
  }

  const sceneData = scene.map(obj => {
    const textureName = Object.entries(textures).find(([key, path]) => obj.texture === loadedTextures[path])?.[0] || "Madeira";

    return {
      model: obj.model,
      position: {
        x: parseFloat(obj.position[0].toFixed(6)),
        y: parseFloat(obj.position[1].toFixed(6)),
        z: parseFloat(obj.position[2].toFixed(6))
      },
      scale: parseFloat(obj.scale.toFixed(6)),
      rotationY: parseFloat(obj.rotationY.toFixed(6)),
      texture: textureName 
    };
  });

  const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "scene.json";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function loadSceneFromJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    scene.length = 0; 

    for (const objData of JSON.parse(e.target.result)) {
      if (!modelVertexBuffer[objData.model]) {
        const vertices = await loadOBJ(models[objData.model]);
        if (!vertices) {
          console.error(`Erro ao carregar modelo: ${objData.model}`);
          continue;
        }

        modelVertexBuffer[objData.model] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, modelVertexBuffer[objData.model]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        vertexCounts[objData.model] = vertices.length / 5;
      }
      
      const textureName = objData.texture || "Madeira"
      const texture = loadTexture(textures[textureName]);

      scene.push({
        model: objData.model,
        position: [objData.position.x, objData.position.y, objData.position.z],
        scale: objData.scale,
        rotationY: objData.rotationY,
        textureName: textureName,
        texture: texture 
      });
    }

    updateSceneModelList();
    renderSceneInstanced();
  };

  reader.readAsText(file);
}

document.getElementById("saveScene").addEventListener("click", saveSceneToJson);
document.getElementById("loadScene").addEventListener("click", () => {
  document.getElementById("loadSceneInput").click(); 
});
document.getElementById("loadSceneInput").addEventListener("change", loadSceneFromJson);

initializeInstanceBuffers();
initializeShaders();
renderSceneInstanced();
