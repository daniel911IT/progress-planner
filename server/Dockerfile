FROM node:22-alpine AS build
WORKDIR /app
COPY server/package.json ./package.json
COPY server/tsconfig.json ./tsconfig.json
RUN npm install
COPY server/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
