# Despliegue del servidor en Google Cloud Run

Servicio: `packages/server` (Socket.IO). Por ahora solo expone `/health` y un `ping`;
las salas de juego se agregan después. Pensado para quedarse dentro de la capa gratuita.

## 1. Cuenta y proyecto (una vez)
1. Crea un proyecto en https://console.cloud.google.com (anota el **ID del proyecto**).
2. Activa la facturación (pide tarjeta, aunque la capa gratuita no cobra).
3. **Alerta de presupuesto:** Facturación → Presupuestos y alertas → crea uno de 1–5 USD con avisos al 50 % y 100 %.
   (Avisa, no corta el gasto por sí solo.)

## 2. Herramientas
Instala la CLI de Google Cloud: https://cloud.google.com/sdk/docs/install

```
gcloud auth login
gcloud config set project TU_ID_DE_PROYECTO
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 3. Desplegar (desde la raíz del repositorio)
Región sugerida: `us-east1` (región de precio Tier 1, la más cercana a Colombia entre las de capa gratuita).

```
gcloud run deploy carrom-server --source . --region us-east1 --allow-unauthenticated --port 8080 --timeout 3600 --min-instances 0 --max-instances 1 --cpu 1 --memory 512Mi
```

- La primera vez pregunta si crear el repositorio de Artifact Registry `cloud-run-source-deploy`: responde `Y`.
- `--max-instances 1`: las salas viven en la memoria de la instancia, así que debe haber una sola.
- `--min-instances 0`: se apaga cuando nadie juega y no gasta (la primera conexión tarda unos segundos).
- `--timeout 3600`: una conexión WebSocket dura como máximo 60 min; el cliente debe reconectarse.

Al terminar imprime la URL del servicio (`https://carrom-server-XXXX-ue.a.run.app`).

## 4. Comprobar
```
npm run smoke -w @carrom/server -- https://TU-URL.run.app
```
Debe mostrar `health` y `OK: WebSocket conectado`.

## 5. Restringir orígenes (cuando el cliente esté publicado)
Para aceptar solo tu juego (itch.io, tu dominio):
```
gcloud run services update carrom-server --region us-east1 --update-env-vars ALLOWED_ORIGINS=https://TU-ORIGEN
```
(varios orígenes separados por comas; sin esta variable se acepta cualquiera, solo apto para pruebas).

## Probar en local
```
npm run dev:server          # http://localhost:8080
npm run smoke -w @carrom/server
```

## Actualizar el servidor (cada vez que cambie `packages/server` o `packages/core`)
Es el mismo comando del paso 3; Cloud Run reconstruye y reemplaza la revisión:
```
gcloud run deploy carrom-server --source . --region us-east1
```
(Recuerda `npm install` y `npm test` antes. Prueba de salas: `npm test -w @carrom/server`.)

## Cómo funciona el modo en línea
- `crear` → el servidor da un código de 4 letras; `join` con ese código → empieza la partida.
- El jugador en turno manda `{t, v}` (posición en su línea base y velocidad). El servidor lo valida,
  simula el tiro completo con `@carrom/core` y envía a ambos el resultado oficial.
  Los clientes animan el tiro con su propia simulación y al terminar adoptan el estado del servidor.
- Si se corta la conexión (o Cloud Run cierra el WebSocket a los 60 min), el cliente se reconecta y
  recupera su asiento con un token. Si alguien no vuelve en 2 minutos, la sala se cierra.
- URL del servidor en el cliente: `VITE_SERVER_URL` al compilar (por defecto, la de Cloud Run).
