# **Editor 3D Interativo com WebGL**

## 📌 **Descrição**
Este projeto é um **editor 3D interativo** desenvolvido em **WebGL**, que permite ao usuário visualizar, manipular e personalizar modelos 3D diretamente no navegador. A aplicação oferece suporte a movimentação da câmera, rotação de objetos, alteração de texturas e renderização otimizada por instâncias.

## 🎯 **Funcionalidades**
✔ **Renderização 3D interativa** com WebGL.  
✔ **Carregamento de modelos em formato `.obj`**.  
✔ **Movimentação da câmera e zoom** para visualização personalizada.  
✔ **Rotação, escalonamento e posicionamento de objetos na cena**.  
✔ **Troca dinâmica de texturas** para personalização dos modelos.  
✔ **Renderização instanciada**, otimizando o uso da GPU.  
✔ **Salvar e carregar cenas em JSON**.  

## 🛠️ **Tecnologias Utilizadas**
- **JavaScript** para lógica do projeto.
- **WebGL** para renderização gráfica.
- **GLSL** (Shaders) para processamento gráfico na GPU.
- **mat4.js** para cálculos de transformações 3D.

## 📂 **Estrutura do Projeto**
```
📦 webgl-3d-editor
 ├── 📂 assets
 │   ├── 📂 models  # Modelos 3D (.obj)
 │   ├── 📂 textures  # Imagens de texturas (.png, .jpg)
 │
 ├── 📜 index.html  # Interface da aplicação
 ├── 📜 main.js  # Lógica principal do projeto
 ├── 📜 shaders.js  # Código dos shaders WebGL
 ├── 📜 utils.js  # Funções auxiliares
 ├── 📜 README.md  # Documentação do projeto
```

## 🚀 **Instalação e Execução**

1️⃣ **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/webgl-3d-editor.git
cd webgl-3d-editor
```

2️⃣ **Abra o arquivo `index.html` no navegador:**
```bash
# Em um ambiente local
live-server  # (se instalado via npm)
# Ou apenas abra manualmente no navegador
```

## 🔍 **Como Funciona?**
- **Adicionar Modelos:** Clique na lista de modelos para adicioná-los à cena.
- **Manipular Objetos:** Selecione um objeto e edite posição, escala e rotação.
- **Trocar Texturas:** Escolha uma textura disponível para alterar a aparência.
- **Salvar Cena:** Exporte a cena como JSON para carregamento posterior.
- **Interagir com a Câmera:** Arraste para rotacionar e use a roda do mouse para zoom.

## 🖥️ **Como Funciona a Renderização?**
O projeto usa **renderização instanciada** para otimizar o desempenho, garantindo que cada modelo seja carregado **apenas uma vez** e reutilizado para múltiplas instâncias. Além disso, os **shaders processam os vértices e texturas diretamente na GPU**.

### 📌 **Shaders Utilizados**
- **Vertex Shader:** Define a posição dos vértices na tela.
- **Fragment Shader:** Processa cores e aplica texturas aos modelos.

## 📖 **Explicação Técnica**
A renderização ocorre seguindo os seguintes passos:
1. **Carregar o modelo 3D e armazenar em buffers da GPU**.
2. **Configurar shaders para processar os vértices e texturas**.
3. **Usar renderização instanciada (`drawArraysInstancedANGLE`) para otimizar múltiplos modelos**.
4. **Renderizar a cena e atualizar dinamicamente conforme o usuário interage**.

## 📜 **Licença**
Este projeto é open-source sob a licença MIT.

---

**Desenvolvido por Cecilia Botelho** 🚀

