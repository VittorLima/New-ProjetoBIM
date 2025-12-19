# BIM Viewer + AR (Three.js + ThatOpen Components)

Projeto de visualização BIM com suporte a **IFC**, **Fragments**, **seleção de elementos** e **Realidade Aumentada (WebXR)**.

---

## Funcionalidades

- Carregamento de arquivos IFC
- Conversão automática para Fragments
- Visualização 3D com Three.js
- Modo AR (WebXR)

---

## Versões Utilizadas

Estas são as versões **exatas** utilizadas e testadas no projeto:

```
@thatopen/components        3.2.0
@thatopen/components-front  3.2.0
@thatopen/fragments         3.2.0
three                       0.178.0
web-ifc                     0.0.72
vite                        7.2.2
typescript                  5.9.3
@types/three                0.181.0
@types/node                 24.10.1
```

---

## Requisitos

- Node.js 18+
- NPM 8+
- Chrome (Desktop ou Android)
- Android físico para AR

> iOS não suporta WebXR.

---

## Instalação

```bash
npm install three@0.178.0
npm install @thatopen/components@3.2.0
npm install @thatopen/components-front@3.2.0
npm install @thatopen/fragments@3.2.0
npm install web-ifc@0.0.72

npm install -D vite@7.2.2
npm install -D typescript@5.9.3
npm install -D @types/three@0.181.0
npm install -D @types/node@24.10.1
```

---

## Estrutura do Projeto

```
/public
 └─ workers/worker.mjs
/src
 └─ main.ts
vite.config.js
tsconfig.json
package.json
```

---

## Executando o Projeto

### Local:
```bash
npm run dev
```

### Acesso pelo celular (mesma rede):
```bash
npm run dev -- --host
```

Acesse:
```
http://SEU-IP:5173
```

---

## Modo AR

- Funciona apenas em Android
- Chrome com suporte WebXR
- Permissões de câmera necessárias

---
