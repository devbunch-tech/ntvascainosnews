# Imagem da apps/api. O contexto de build é a RAIZ do monorepo, não esta pasta —
# o package-lock.json e o packages/shared vivem lá:
#
#   docker build -f apps/api/Dockerfile -t ntv-api .
#
# Serve para Render, Fly, Railway ou um VPS. O que a plataforma precisa saber:
#   • porta: vem de $PORT (o servidor lê e obedece)
#   • health check: GET /health
FROM node:20-slim

WORKDIR /app

# O lock, os manifests e o @ntv/shared inteiro primeiro: assim a camada de
# dependências só é refeita quando elas mudam, não a cada alteração da API.
# O shared vem completo porque seu script `prepare` roda `tsc` durante o
# `npm ci` e precisa do tsconfig e do src já presentes.
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/

# Sem NODE_ENV=production aqui: o typescript que compila o @ntv/shared é
# devDependency e seria pulado.
RUN npm ci --workspace @ntv/api --workspace @ntv/shared --include-workspace-root

COPY apps/api apps/api

ENV NODE_ENV=production

# Uploads (avatar, capa, foto de produto) gravam em disco. Em plataformas com
# filesystem efêmero, monte um volume persistente aqui — sem isso as imagens
# somem no próximo deploy. Veja docs/deploy.md.
ENV UPLOADS_DIR=/data/uploads
VOLUME /data

EXPOSE 4010
CMD ["npm", "run", "start", "-w", "@ntv/api"]
